import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import * as p from '@clack/prompts'
import pc from 'picocolors'

// ── Types ───────────────────────────────────────────────────

interface CliFlags {
  skipExisting: boolean
  noCompetitors: boolean
}

interface ScenarioResult {
  opsPerSec: number
  [key: string]: any
}

interface BenchmarkResult {
  benchmark: { framework: string; library: string; store: string; runtime: string }
  scenarios: Record<string, ScenarioResult>
}

// ── Constants ───────────────────────────────────────────────

const REPO_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..')
const BENCH_DIR = path.resolve(REPO_ROOT, 'benchmarks')
const RESULTS_DIR = path.resolve(BENCH_DIR, 'results')
const COMPOSE_FILE = path.resolve(REPO_ROOT, 'docker-compose.yml')
const COMPOSE = `docker compose -f "${COMPOSE_FILE}"`

const VERSION = (() => {
  try { return fs.readFileSync(path.resolve(REPO_ROOT, 'VERSION'), 'utf-8').trim() }
  catch { return 'dev' }
})()
const VERSION_DIR = path.resolve(RESULTS_DIR, `v${VERSION}`)

const ALL_STORES = ['memory', 'sqlite', 'redis', 'postgres', 'valkey', 'dragonfly', 'mongodb', 'mysql'] as const
const DOCKER_STORES = ['redis', 'postgres', 'valkey', 'dragonfly', 'mongodb', 'mysql'] as const
const LOCAL_STORES = ['memory', 'sqlite'] as const
const NODE_FRAMEWORKS = ['store', 'express', 'fastify', 'hono', 'nestjs'] as const
const BUN_FRAMEWORKS = ['store', 'bun-serve', 'elysia', 'hono'] as const

type Store = (typeof ALL_STORES)[number]
type Runtime = 'node' | 'bun'

// ── Shell helpers ───────────────────────────────────────────

function exec(cmd: string, opts?: { cwd?: string; silent?: boolean }): string {
  return execSync(cmd, {
    cwd: opts?.cwd ?? REPO_ROOT,
    encoding: 'utf-8',
    stdio: opts?.silent ? 'pipe' : 'inherit',
  }) as string
}

function execSafe(cmd: string, opts?: { cwd?: string }): boolean {
  try {
    execSync(cmd, { cwd: opts?.cwd ?? REPO_ROOT, stdio: 'pipe', encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

// ── Docker management ───────────────────────────────────────

function needsDocker(store: string): boolean {
  return store !== 'memory' && store !== 'sqlite'
}

function startStore(store: string): void {
  if (!needsDocker(store)) return
  const timeout = store === 'mysql' ? 120 : 60
  const s = p.spinner()
  s.start(`Starting ${store}...`)
  try {
    exec(`${COMPOSE} --profile ${store} up -d --wait --wait-timeout ${timeout}`, { silent: true })
    s.stop(pc.green(`${store} ready`))
  } catch {
    s.stop(pc.red(`Failed to start ${store}`))
    p.log.error('Is Docker running?')
    process.exit(1)
  }
}

function stopStore(store: string): void {
  if (!needsDocker(store)) return
  const s = p.spinner()
  s.start(`Stopping ${store}...`)
  execSafe(`${COMPOSE} --profile ${store} down`)
  s.stop(pc.dim(`${store} stopped`))
}

function stopAll(): void {
  execSafe(`${COMPOSE} --profile all down --remove-orphans`)
}

function cleanStore(store: string): void {
  switch (store) {
    case 'redis':
      execSafe('docker exec hitlimit-redis redis-cli FLUSHDB'); break
    case 'postgres':
      execSafe("docker exec hitlimit-postgres psql -U hitlimit -d hitlimit_test -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"); break
    case 'valkey':
      execSafe('docker exec hitlimit-valkey valkey-cli FLUSHDB'); break
    case 'dragonfly':
      execSafe('docker exec hitlimit-dragonfly redis-cli FLUSHDB'); break
    case 'mongodb':
      execSafe("docker exec hitlimit-mongodb mongosh hitlimit_test --eval 'db.dropDatabase()'"); break
    case 'mysql':
      execSafe('docker exec hitlimit-mysql mysqladmin -uhitlimit -phitlimit drop hitlimit_test -f')
      execSafe('docker exec hitlimit-mysql mysqladmin -uhitlimit -phitlimit create hitlimit_test')
      break
  }
}

// ── Results tracking ────────────────────────────────────────

function countResults(dir?: string): number {
  const d = dir ?? VERSION_DIR
  if (!fs.existsSync(d)) return 0
  return fs.readdirSync(d).filter(f => f.endsWith('.json')).length
}

function resultExists(name: string): boolean {
  return fs.existsSync(path.resolve(VERSION_DIR, `${name}.json`))
}

function getVersionDirs(): Array<{ version: string; count: number; isCurrent: boolean }> {
  if (!fs.existsSync(RESULTS_DIR)) return []
  return fs.readdirSync(RESULTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('v'))
    .map(d => ({
      version: d.name,
      count: countResults(path.resolve(RESULTS_DIR, d.name)),
      isCurrent: d.name === `v${VERSION}`,
    }))
    .sort((a, b) => compareSemver(a.version, b.version))
}

// ── Competitor discovery ────────────────────────────────────

function findCompetitors(runtime: Runtime, framework: string, store: string): string[] {
  const baseDir = path.resolve(BENCH_DIR, runtime, framework)
  if (!fs.existsSync(baseDir)) return []
  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'hitlimit')
    .filter(d => fs.existsSync(path.resolve(baseDir, d.name, `${store}.ts`)))
    .map(d => d.name)
}

// ── Benchmark runner ────────────────────────────────────────

function runBench(runtime: Runtime, file: string): void {
  const fullPath = path.resolve(BENCH_DIR, file)
  if (!fs.existsSync(fullPath)) return

  p.log.info(pc.dim(`Running: ${file}`))
  try {
    if (runtime === 'node') {
      execSync(`npx tsx "${fullPath}"`, {
        cwd: BENCH_DIR,
        stdio: 'inherit',
        env: { ...process.env, NODE_OPTIONS: '--expose-gc' },
      })
    } else {
      execSync(`bun "${fullPath}"`, { cwd: BENCH_DIR, stdio: 'inherit' })
    }
  } catch {
    p.log.warn(pc.yellow(`Benchmark failed: ${file}`))
  }
}

function runStoreBenchmarks(store: string, flags: CliFlags): number {
  let count = 0
  const runtimes: Array<{ runtime: Runtime; frameworks: readonly string[] }> = [
    { runtime: 'node', frameworks: NODE_FRAMEWORKS },
    { runtime: 'bun', frameworks: BUN_FRAMEWORKS },
  ]

  for (const { runtime, frameworks } of runtimes) {
    for (const fw of frameworks) {
      const file = `${runtime}/${fw}/hitlimit/${store}.ts`
      const resultName = `${runtime}-${fw}-hitlimit-${store}`

      if (!fs.existsSync(path.resolve(BENCH_DIR, file))) continue

      if (flags.skipExisting && resultExists(resultName)) {
        p.log.info(pc.dim(`Skip (exists): ${resultName}`))
        continue
      }

      runBench(runtime, file)
      count++

      if (!flags.noCompetitors) {
        const competitors = findCompetitors(runtime, fw, store)
        for (const comp of competitors) {
          if (needsDocker(store)) cleanStore(store)
          runBench(runtime, `${runtime}/${fw}/${comp}/${store}.ts`)
          count++
        }
      }
    }
  }

  return count
}

// ── Build step ──────────────────────────────────────────────

function buildPackages(): void {
  const s = p.spinner()
  s.start('Building packages...')
  try {
    exec('pnpm build --silent', { silent: true })
    s.stop(pc.green('Packages built'))
  } catch {
    s.stop(pc.yellow('Retrying build (verbose)...'))
    exec('pnpm build')
  }
}

// ── Timing ──────────────────────────────────────────────────

function formatElapsed(startMs: number): string {
  const elapsed = Math.round((Date.now() - startMs) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

// ── Regression comparison ───────────────────────────────────

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}

function compareFiles(oldFile: string, newFile: string): { regressions: number; improvements: number } {
  const oldData: BenchmarkResult = JSON.parse(fs.readFileSync(oldFile, 'utf-8'))
  const newData: BenchmarkResult = JSON.parse(fs.readFileSync(newFile, 'utf-8'))
  const label = `${newData.benchmark.runtime}-${newData.benchmark.framework}-${newData.benchmark.library}-${newData.benchmark.store}`

  let regressions = 0
  let improvements = 0

  for (const [scenario, newResult] of Object.entries(newData.scenarios)) {
    const oldResult = oldData.scenarios[scenario]
    if (!oldResult) continue

    const diff = ((newResult.opsPerSec - oldResult.opsPerSec) / oldResult.opsPerSec) * 100
    const diffStr = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`
    const change = `${oldResult.opsPerSec.toLocaleString()} -> ${newResult.opsPerSec.toLocaleString()} (${diffStr})`

    if (diff < -10) {
      p.log.error(`${pc.red('REGRESSION')}  ${label} [${scenario}]: ${change}`)
      regressions++
    } else if (diff > 10) {
      p.log.success(`${pc.green('IMPROVED')}    ${label} [${scenario}]: ${change}`)
      improvements++
    } else {
      p.log.step(`${pc.dim('OK')}          ${label} [${scenario}]: ${change}`)
    }
  }

  return { regressions, improvements }
}

// ── Commands ────────────────────────────────────────────────

async function cmdAll(flags: CliFlags): Promise<void> {
  const existing = countResults()
  if (existing > 0 && !flags.skipExisting) {
    p.log.warn(`${existing} results already exist for v${VERSION}`)
    const skip = await p.confirm({ message: 'Skip already-completed benchmarks?' })
    if (p.isCancel(skip)) { p.cancel('Cancelled'); process.exit(0) }
    if (skip) flags.skipExisting = true
  }

  p.intro(pc.bold(pc.cyan(`Full Benchmark Suite — v${VERSION}`)))
  buildPackages()

  const startMs = Date.now()
  let total = 0

  // Phase 1: Local stores
  p.log.step(pc.bold('Phase 1: Local stores (no Docker)'))
  for (const store of LOCAL_STORES) {
    p.log.info(pc.cyan(`Benchmarking: ${store}`))
    total += runStoreBenchmarks(store, flags)
  }

  // Phase 2: Docker stores (isolated)
  p.log.step(pc.bold('Phase 2: Docker stores (isolated — one at a time)'))
  stopAll()

  for (const store of DOCKER_STORES) {
    p.log.info(pc.cyan(`Benchmarking: ${store}`))
    startStore(store)
    total += runStoreBenchmarks(store, flags)
    stopStore(store)
  }

  const finalCount = countResults()
  p.outro(`${pc.green(`${total} benchmarks executed`)} in ${formatElapsed(startMs)} | ${finalCount} total results in results/v${VERSION}/`)
}

async function cmdStore(storeNames: string[], flags: CliFlags): Promise<void> {
  let stores: string[]

  if (storeNames.length === 0) {
    const selected = await p.multiselect({
      message: 'Which stores to benchmark?',
      options: ALL_STORES.map(s => ({
        value: s,
        label: s,
        hint: needsDocker(s) ? 'Docker' : 'local',
      })),
      required: true,
    })
    if (p.isCancel(selected)) { p.cancel('Cancelled'); process.exit(0) }
    stores = selected as string[]
  } else {
    stores = storeNames
  }

  p.intro(pc.bold(pc.cyan(`Store Benchmark — v${VERSION}`)))
  buildPackages()
  stopAll()

  const startMs = Date.now()
  let total = 0

  for (const store of stores) {
    p.log.step(pc.cyan(`Benchmarking: ${store}`))
    if (needsDocker(store)) startStore(store)
    total += runStoreBenchmarks(store, flags)
    if (needsDocker(store)) stopStore(store)
  }

  p.outro(`${pc.green(`${total} benchmarks executed`)} in ${formatElapsed(startMs)}`)
}

async function cmdQuick(): Promise<void> {
  p.intro(pc.bold(pc.cyan(`Quick Benchmark — v${VERSION} (memory + sqlite)`)))
  buildPackages()

  const startMs = Date.now()
  let total = 0
  const flags: CliFlags = { skipExisting: false, noCompetitors: false }

  for (const store of LOCAL_STORES) {
    p.log.step(pc.cyan(`Benchmarking: ${store}`))
    total += runStoreBenchmarks(store, flags)
  }

  p.outro(`${pc.green(`${total} benchmarks executed`)} in ${formatElapsed(startMs)}`)
}

async function cmdSingle(): Promise<void> {
  p.intro(pc.bold(pc.cyan(`Single Benchmark — v${VERSION}`)))

  const runtime = await p.select({
    message: 'Select runtime',
    options: [
      { value: 'node' as const, label: 'Node.js' },
      { value: 'bun' as const, label: 'Bun' },
    ],
  })
  if (p.isCancel(runtime)) { p.cancel('Cancelled'); process.exit(0) }

  const frameworks = runtime === 'node' ? NODE_FRAMEWORKS : BUN_FRAMEWORKS
  const framework = await p.select({
    message: 'Select framework',
    options: frameworks.map(f => ({ value: f, label: f })),
  })
  if (p.isCancel(framework)) { p.cancel('Cancelled'); process.exit(0) }

  const availableStores = ALL_STORES.filter(s =>
    fs.existsSync(path.resolve(BENCH_DIR, runtime as string, framework as string, 'hitlimit', `${s}.ts`))
  )
  if (availableStores.length === 0) {
    p.log.error(`No benchmarks found for ${runtime}/${framework}`)
    process.exit(1)
  }

  const store = await p.select({
    message: 'Select store',
    options: availableStores.map(s => ({
      value: s,
      label: s,
      hint: needsDocker(s) ? 'requires Docker' : 'local',
    })),
  })
  if (p.isCancel(store)) { p.cancel('Cancelled'); process.exit(0) }

  const competitors = findCompetitors(runtime as Runtime, framework as string, store as string)
  let includeCompetitors = false
  if (competitors.length > 0) {
    const answer = await p.confirm({
      message: `Include competitors? (${competitors.join(', ')})`,
    })
    if (p.isCancel(answer)) { p.cancel('Cancelled'); process.exit(0) }
    includeCompetitors = answer
  }

  buildPackages()

  if (needsDocker(store as string)) {
    stopAll()
    startStore(store as string)
  }

  p.log.step(pc.cyan(`Running: ${runtime} / ${framework} / ${store}`))
  runBench(runtime as Runtime, `${runtime}/${framework}/hitlimit/${store}.ts`)

  if (includeCompetitors) {
    for (const comp of competitors) {
      cleanStore(store as string)
      runBench(runtime as Runtime, `${runtime}/${framework}/${comp}/${store}.ts`)
    }
  }

  if (needsDocker(store as string)) {
    cleanStore(store as string)
    stopStore(store as string)
  }

  p.outro(pc.green('Done!'))
}

function cmdStatus(): void {
  p.intro(pc.bold(pc.cyan(`Results Status — v${VERSION}`)))

  const count = countResults()
  if (count === 0) {
    p.log.warn(`No results yet for v${VERSION}`)
  } else {
    p.log.success(`${count} results in results/v${VERSION}/`)

    const runtimes: Array<{ runtime: string; frameworks: readonly string[] }> = [
      { runtime: 'node', frameworks: NODE_FRAMEWORKS },
      { runtime: 'bun', frameworks: BUN_FRAMEWORKS },
    ]

    for (const { runtime, frameworks } of runtimes) {
      const lines: string[] = []
      for (const fw of frameworks) {
        const done: string[] = []
        const missing: string[] = []
        for (const store of ALL_STORES) {
          if (resultExists(`${runtime}-${fw}-hitlimit-${store}`)) {
            done.push(pc.green(store))
          } else {
            missing.push(pc.dim(store))
          }
        }
        lines.push(`  ${pc.bold(fw.padEnd(12))} ${[...done, ...missing].join('  ')}`)
      }
      p.note(lines.join('\n'), runtime)
    }
  }

  const versions = getVersionDirs()
  if (versions.length > 0) {
    const vLines = versions.map(v => {
      if (v.isCurrent) return `  ${pc.bold(`${v.version}`)} (${v.count} results) ${pc.cyan('<- current')}`
      return `  ${pc.dim(`${v.version} (${v.count} results)`)}`
    })
    p.note(vLines.join('\n'), 'All versions')
  }

  p.outro('')
}

async function cmdClean(target?: string): Promise<void> {
  p.intro(pc.bold(pc.cyan('Benchmark Results Cleanup')))

  if (!fs.existsSync(RESULTS_DIR)) {
    p.log.warn('No results directory found')
    p.outro('Nothing to clean')
    return
  }

  const versions = getVersionDirs()
  if (versions.length === 0) {
    p.log.warn('No version results found')
    p.outro('Nothing to clean')
    return
  }

  if (target) {
    const targetDir = path.resolve(RESULTS_DIR, target)
    if (fs.existsSync(targetDir)) {
      const c = countResults(targetDir)
      const ok = await p.confirm({ message: `Delete ${c} results from ${target}?` })
      if (!p.isCancel(ok) && ok) {
        fs.rmSync(targetDir, { recursive: true })
        p.log.success(`Deleted ${target}`)
      }
    } else {
      p.log.error(`Version ${target} not found`)
    }
    p.outro('')
    return
  }

  const choice = await p.select({
    message: 'Which version to clean?',
    options: [
      ...versions.map(v => ({
        value: v.version,
        label: `${v.version} (${v.count} results)`,
        hint: v.isCurrent ? 'current version' : undefined,
      })),
      { value: 'all-except-current', label: 'All except current version' },
      { value: 'cancel', label: 'Cancel' },
    ],
  })
  if (p.isCancel(choice) || choice === 'cancel') {
    p.cancel('Cancelled')
    return
  }

  if (choice === 'all-except-current') {
    for (const v of versions) {
      if (v.isCurrent) continue
      fs.rmSync(path.resolve(RESULTS_DIR, v.version), { recursive: true })
      p.log.success(`Deleted ${v.version}`)
    }
  } else {
    fs.rmSync(path.resolve(RESULTS_DIR, choice as string), { recursive: true })
    p.log.success(`Deleted ${choice}`)
  }

  p.outro('')
}

function cmdCompare(): void {
  p.intro(pc.bold(pc.cyan('Regression Check')))

  if (!fs.existsSync(RESULTS_DIR)) {
    p.log.warn('No results directory found')
    p.outro('Nothing to compare')
    return
  }

  const versions = fs.readdirSync(RESULTS_DIR)
    .filter(d => d.startsWith('v') && fs.statSync(path.join(RESULTS_DIR, d)).isDirectory())
    .sort(compareSemver)

  if (versions.length < 2) {
    p.log.warn(`Only ${versions.length} version(s) found — need at least 2`)
    p.outro('Nothing to compare')
    return
  }

  const oldVer = versions[versions.length - 2]
  const newVer = versions[versions.length - 1]
  const oldDir = path.join(RESULTS_DIR, oldVer)
  const newDir = path.join(RESULTS_DIR, newVer)

  p.log.step(`Comparing ${pc.bold(oldVer)} -> ${pc.bold(newVer)}`)

  const newFiles = fs.readdirSync(newDir).filter(f => f.endsWith('.json'))
  let totalRegressions = 0
  let totalImprovements = 0
  let compared = 0

  for (const file of newFiles) {
    const oldFile = path.join(oldDir, file)
    const newFile = path.join(newDir, file)

    if (!fs.existsSync(oldFile)) {
      p.log.info(pc.dim(`NEW  ${file} (no previous result)`))
      continue
    }

    const { regressions, improvements } = compareFiles(oldFile, newFile)
    totalRegressions += regressions
    totalImprovements += improvements
    compared++
  }

  const summary = `${compared} benchmarks compared: ${totalRegressions} regressions, ${totalImprovements} improvements`
  if (totalRegressions > 0) {
    p.note(pc.red(summary), 'FAILED — regressions detected')
    p.outro('')
    process.exit(1)
  } else {
    p.note(pc.green(summary), 'PASSED — no regressions')
    p.outro('')
  }
}

// ── Interactive menu ────────────────────────────────────────

async function interactiveMenu(): Promise<void> {
  const existing = countResults()
  const subtitle = existing > 0 ? pc.dim(` | ${existing} results exist`) : ''

  p.intro(`${pc.bold('hitlimit benchmark suite')} ${pc.dim(`v${VERSION}`)}${subtitle}`)

  const command = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'all',     label: 'Run ALL benchmarks',     hint: 'full suite, Docker isolated' },
      { value: 'store',   label: 'Run by store',           hint: 'pick specific stores' },
      { value: 'quick',   label: 'Quick run',              hint: 'memory + sqlite, no Docker' },
      { value: 'single',  label: 'Run single benchmark',   hint: 'interactive picker' },
      { value: 'status',  label: 'View results status',    hint: 'completed benchmarks grid' },
      { value: 'clean',   label: 'Clean old results',      hint: 'delete version results' },
      { value: 'compare', label: 'Compare versions',       hint: 'regression check' },
    ],
  })
  if (p.isCancel(command)) { p.cancel('Cancelled'); process.exit(0) }

  const flags: CliFlags = { skipExisting: false, noCompetitors: false }

  switch (command) {
    case 'all':     return cmdAll(flags)
    case 'store':   return cmdStore([], flags)
    case 'quick':   return cmdQuick()
    case 'single':  return cmdSingle()
    case 'status':  return cmdStatus()
    case 'clean':   return cmdClean()
    case 'compare': return cmdCompare()
  }
}

// ── Usage ───────────────────────────────────────────────────

function showUsage(): void {
  console.log(`
${pc.bold('  hitlimit benchmark suite')}

${pc.bold('  Usage:')}
    npx tsx benchmarks/cli.ts [command] [options]

${pc.bold('  Commands:')}
    ${pc.cyan('all')}                  Run ALL benchmarks (full suite, Docker isolated)
    ${pc.cyan('store')} [names...]     Run all frameworks for specific store(s)
    ${pc.cyan('quick')}                Run memory + sqlite only (no Docker)
    ${pc.cyan('single')}               Interactive single benchmark picker
    ${pc.cyan('status')}               Show which benchmarks exist for current version
    ${pc.cyan('clean')} [version]      Clean benchmark results
    ${pc.cyan('compare')}              Compare latest two versions (regression check)

${pc.bold('  Options:')}
    --skip-existing      Skip benchmarks that already have results
    --no-competitors     Skip competitor library benchmarks

${pc.bold('  Examples:')}
    ${pc.dim('npx tsx benchmarks/cli.ts')}                          Interactive menu
    ${pc.dim('npx tsx benchmarks/cli.ts all')}                      Full suite
    ${pc.dim('npx tsx benchmarks/cli.ts all --skip-existing')}      Resume interrupted run
    ${pc.dim('npx tsx benchmarks/cli.ts store redis postgres')}     Specific stores only
    ${pc.dim('npx tsx benchmarks/cli.ts quick')}                    Memory + SQLite only
    ${pc.dim('npx tsx benchmarks/cli.ts single')}                   Pick one benchmark
    ${pc.dim('npx tsx benchmarks/cli.ts status')}                   View results
    ${pc.dim('npx tsx benchmarks/cli.ts clean')}                    Clean old results
    ${pc.dim('npx tsx benchmarks/cli.ts compare')}                  Check regressions
`)
}

// ── CLI argument parsing ────────────────────────────────────

function parseArgs(): { command: string | null; args: string[]; flags: CliFlags } {
  const rawArgs = process.argv.slice(2)
  const flags: CliFlags = { skipExisting: false, noCompetitors: false }
  const positional: string[] = []

  for (const arg of rawArgs) {
    if (arg === '--skip-existing') flags.skipExisting = true
    else if (arg === '--no-competitors') flags.noCompetitors = true
    else if (arg === '--help' || arg === '-h') positional.unshift('help')
    else positional.push(arg)
  }

  return { command: positional[0] || null, args: positional.slice(1), flags }
}

// ── Main ────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log()
  p.cancel('Interrupted')
  try { stopAll() } catch {}
  process.exit(130)
})

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs()

  if (!command) return interactiveMenu()

  switch (command) {
    case 'all':     return cmdAll(flags)
    case 'store':   return cmdStore(args, flags)
    case 'quick':   return cmdQuick()
    case 'single':  return cmdSingle()
    case 'status':  return cmdStatus()
    case 'clean':   return cmdClean(args[0])
    case 'compare': return cmdCompare()
    case 'help':    return showUsage()
    default:
      p.log.error(`Unknown command: ${command}`)
      showUsage()
      process.exit(1)
  }
}

main().catch(err => {
  p.log.error(err.message ?? err)
  process.exit(1)
})
