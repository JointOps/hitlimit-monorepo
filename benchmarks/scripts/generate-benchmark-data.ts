import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScenarioResult {
  description: string
  keys: number
  opsPerSec: number
  latency: {
    avgNs: number
    p50Ns: number
    p95Ns: number
    p99Ns: number
    minNs: number
    maxNs: number
  }
  stdDev: number
  marginOfError: number
  memoryMB: number
}

interface BenchmarkOutput {
  benchmark: {
    framework: string
    library: string
    store: string
    runtime: string
  }
  environment: {
    runtimeVersion: string
    os: string
    arch: string
    cpu: string
    cpuCores: number
    memoryGB: number
    docker: boolean
  }
  versions: Record<string, string>
  config: {
    warmupIterations: number
    iterations: number
    runs: number
  }
  date: string
  scenarios: Record<string, ScenarioResult>
}

interface ScenarioData {
  opsPerSec: number
  latencyAvgNs: number
  memoryMB?: number
}

type StoreData = Partial<Record<'singleIp' | 'multi1k' | 'multi10k', ScenarioData>>

interface OutputJson {
  version: string
  date: string
  environment: {
    cpu: string
    arch: string
    ram: string
    nodeVersion: string
    bunVersion: string
    redisVersion: string
    postgresVersion: string
  }
  node: Record<string, StoreData>
  bun: Record<string, StoreData>
  competitors: {
    rateLimiterFlexible: Record<string, StoreData>
    expressRateLimit: Record<string, StoreData>
  }
  httpOverhead: {
    express: { withoutReqSec: number; withReqSec: number }
    fastify: { withoutReqSec: number; withReqSec: number }
  }
  bundleSize: {
    node: { core: string; total: string }
    bun: { core: string; total: string }
  }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const RESULTS_DIR = path.join(ROOT, 'benchmarks', 'results')
const OUTPUT_JSON = path.join(ROOT, 'docs', 'src', 'data', 'benchmarks.json')

const README_FILES = [
  path.join(ROOT, 'packages', 'hitlimit', 'README.md'),
  path.join(ROOT, 'packages', 'hitlimit-bun', 'README.md'),
  path.join(ROOT, 'benchmarks', 'README.md'),
]

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatOps(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return m % 1 === 0 ? `${m}M` : `${parseFloat(m.toFixed(2))}M`
  }
  if (n >= 1_000) {
    const k = n / 1_000
    return k % 1 === 0 ? `${k}K` : `${parseFloat(k.toFixed(1))}K`
  }
  return String(n)
}

function formatOpsComma(n: number): string {
  return n.toLocaleString('en-US')
}

function formatLatency(ns: number): string {
  if (ns >= 1_000_000) {
    const ms = ns / 1_000_000
    return `${parseFloat(ms.toFixed(1))}ms`
  }
  if (ns >= 1_000) {
    const us = ns / 1_000
    return `${parseFloat(us.toFixed(1))}\u03BCs`
  }
  return `${Math.round(ns)}ns`
}

// ---------------------------------------------------------------------------
// Semver sorting
// ---------------------------------------------------------------------------

function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/, '')
  const parts = clean.split('.').map(Number)
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

function compareSemver(a: string, b: string): number {
  const [a0, a1, a2] = parseSemver(a)
  const [b0, b1, b2] = parseSemver(b)
  if (a0 !== b0) return a0 - b0
  if (a1 !== b1) return a1 - b1
  return a2 - b2
}

// ---------------------------------------------------------------------------
// Scenario name mapping
// ---------------------------------------------------------------------------

const SCENARIO_MAP: Record<string, keyof StoreData> = {
  'single-ip': 'singleIp' as keyof StoreData,
  'multi-ip-1k': 'multi1k' as keyof StoreData,
  'multi-ip-10k': 'multi10k' as keyof StoreData,
}

function extractScenarioData(scenario: ScenarioResult, includeMemory: boolean): ScenarioData {
  const data: ScenarioData = {
    opsPerSec: scenario.opsPerSec,
    latencyAvgNs: scenario.latency.avgNs,
  }
  if (includeMemory && scenario.memoryMB > 0) {
    data.memoryMB = scenario.memoryMB
  }
  return data
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function findLatestVersion(): string {
  const dirs = fs.readdirSync(RESULTS_DIR).filter((d) => {
    return d.startsWith('v') && fs.statSync(path.join(RESULTS_DIR, d)).isDirectory()
  })
  if (dirs.length === 0) {
    throw new Error(`No version directories found in ${RESULTS_DIR}`)
  }
  dirs.sort(compareSemver)
  return dirs[dirs.length - 1]
}

function loadResults(versionDir: string): BenchmarkOutput[] {
  const dir = path.join(RESULTS_DIR, versionDir)
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  const results: BenchmarkOutput[] = []

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8')
    results.push(JSON.parse(content) as BenchmarkOutput)
  }

  return results
}

function buildStoreData(result: BenchmarkOutput): StoreData {
  const storeData: StoreData = {}

  for (const [scenarioName, scenario] of Object.entries(result.scenarios)) {
    const key = SCENARIO_MAP[scenarioName]
    if (!key) continue

    // Include memoryMB only for multi-ip-10k to keep output compact
    const includeMemory = scenarioName === 'multi-ip-10k'
    storeData[key] = extractScenarioData(scenario, includeMemory)
  }

  return storeData
}

function buildOutputJson(results: BenchmarkOutput[], version: string): OutputJson {
  // Separate results by category
  const nodeStoreHitlimit = results.filter(
    (r) => r.benchmark.runtime === 'node' && r.benchmark.framework === 'store' && r.benchmark.library === 'hitlimit'
  )
  const bunStoreHitlimit = results.filter(
    (r) => r.benchmark.runtime === 'bun' && r.benchmark.framework === 'store' && r.benchmark.library === 'hitlimit'
  )
  const nodeCompetitorRLF = results.filter(
    (r) =>
      r.benchmark.runtime === 'node' &&
      r.benchmark.framework === 'store' &&
      r.benchmark.library === 'rate-limiter-flexible'
  )
  const nodeCompetitorERL = results.filter(
    (r) =>
      r.benchmark.runtime === 'node' &&
      r.benchmark.framework === 'express' &&
      r.benchmark.library === 'express-rate-limit'
  )

  // Use first hitlimit node result for environment info
  const envSource = nodeStoreHitlimit[0] || results[0]
  const bunEnvSource = bunStoreHitlimit[0]

  // Determine node and bun version strings
  const nodeVersion = envSource?.environment.runtimeVersion || 'unknown'
  const bunVersion = bunEnvSource?.environment.runtimeVersion
    ? `v${bunEnvSource.environment.runtimeVersion.replace(/^v/, '')}`
    : 'unknown'

  // Build node store data
  const node: Record<string, StoreData> = {}
  for (const r of nodeStoreHitlimit) {
    node[r.benchmark.store] = buildStoreData(r)
  }

  // Build bun store data
  const bun: Record<string, StoreData> = {}
  for (const r of bunStoreHitlimit) {
    bun[r.benchmark.store] = buildStoreData(r)
  }

  // Build competitor data: rate-limiter-flexible
  const rateLimiterFlexible: Record<string, StoreData> = {}
  for (const r of nodeCompetitorRLF) {
    rateLimiterFlexible[r.benchmark.store] = buildStoreData(r)
  }

  // Build competitor data: express-rate-limit
  const expressRateLimit: Record<string, StoreData> = {}
  for (const r of nodeCompetitorERL) {
    expressRateLimit[r.benchmark.store] = buildStoreData(r)
  }

  // Extract date from earliest result
  const date = envSource?.date?.split('T')[0] || new Date().toISOString().split('T')[0]

  // Read existing output to preserve httpOverhead and bundleSize (not in raw results)
  let existingOutput: Partial<OutputJson> = {}
  if (fs.existsSync(OUTPUT_JSON)) {
    existingOutput = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf-8'))
  }

  const output: OutputJson = {
    version: version.replace(/^v/, ''),
    date,
    environment: {
      cpu: envSource?.environment.cpu || 'Unknown',
      arch: envSource?.environment.arch?.toUpperCase() || 'Unknown',
      ram: `${envSource?.environment.memoryGB || 0}GB`,
      nodeVersion,
      bunVersion,
      redisVersion: existingOutput.environment?.redisVersion || '7.x',
      postgresVersion: existingOutput.environment?.postgresVersion || '16.x',
    },
    node,
    bun,
    competitors: {
      rateLimiterFlexible,
      expressRateLimit,
    },
    httpOverhead: existingOutput.httpOverhead || {
      express: { withoutReqSec: 45000, withReqSec: 42000 },
      fastify: { withoutReqSec: 65000, withReqSec: 61000 },
    },
    bundleSize: existingOutput.bundleSize || {
      node: { core: '~8KB', total: '~41KB' },
      bun: { core: '~18KB', total: '~48KB' },
    },
  }

  return output
}

// ---------------------------------------------------------------------------
// README update logic
// ---------------------------------------------------------------------------

function generateBarChart(value: number, maxValue: number, maxBars: number = 20): string {
  const ratio = value / maxValue
  const bars = Math.round(ratio * maxBars)
  return '\u2588'.repeat(Math.max(1, bars))
}

function generateNodeHero(data: OutputJson): string {
  const multi10k = data.node.memory?.multi10k
  if (!multi10k) return '**High-performance rate limiting** for Node.js.'
  return `**${formatOps(multi10k.opsPerSec)} ops/sec** at 10K unique IPs. Zero dependencies. One line to protect any Node.js API.`
}

function generateBunHero(data: OutputJson): string {
  const singleIp = data.bun.memory?.singleIp
  const multi10k = data.bun.memory?.multi10k
  if (!singleIp || !multi10k) return '**High-performance rate limiting** built for Bun.'
  return `**${formatOps(singleIp.opsPerSec)} ops/sec** on memory. **${formatOps(multi10k.opsPerSec)} at 10K IPs**. Native bun:sqlite. Atomic Redis Lua. Postgres. Zero dependencies.`
}

function generateNodeStoreTable(data: OutputJson): string {
  const lines: string[] = [
    '| Store | Ops/sec | Latency | When to use |',
    '|-------|---------|---------|-------------|',
  ]

  const storeConfig: { key: string; label: string; scenario: 'multi10k' | 'singleIp'; useCase: string }[] = [
    { key: 'memory', label: 'Memory', scenario: 'multi10k', useCase: 'Single server, no persistence needed' },
    { key: 'sqlite', label: 'SQLite', scenario: 'multi10k', useCase: 'Single server, need persistence' },
    { key: 'redis', label: 'Redis', scenario: 'multi10k', useCase: 'Multi-server / distributed' },
    { key: 'postgres', label: 'Postgres', scenario: 'multi10k', useCase: 'Multi-server / already using Postgres' },
    { key: 'mongodb', label: 'MongoDB', scenario: 'multi10k', useCase: 'Multi-server / NoSQL infrastructure' },
    { key: 'mysql', label: 'MySQL', scenario: 'multi10k', useCase: 'Multi-server / existing MySQL' },
  ]

  for (const cfg of storeConfig) {
    const storeData = data.node[cfg.key]
    if (!storeData) continue
    const scenario = storeData[cfg.scenario]
    if (!scenario) continue

    lines.push(
      `| ${cfg.label} | ${formatOpsComma(scenario.opsPerSec)} | ${formatLatency(scenario.latencyAvgNs)} | ${cfg.useCase} |`
    )
  }

  return lines.join('\n')
}

function generateBunStoreTable(data: OutputJson): string {
  const lines: string[] = [
    '| Store | Ops/sec | Latency | When to use |',
    '|-------|---------|---------|-------------|',
  ]

  const storeConfig: { key: string; label: string; scenario: 'multi10k' | 'singleIp'; useCase: string }[] = [
    { key: 'memory', label: 'Memory', scenario: 'multi10k', useCase: 'Single server, maximum speed' },
    { key: 'sqlite', label: 'bun:sqlite', scenario: 'multi10k', useCase: 'Single server, need persistence' },
    { key: 'redis', label: 'Redis', scenario: 'multi10k', useCase: 'Multi-server / distributed' },
    { key: 'postgres', label: 'Postgres', scenario: 'multi10k', useCase: 'Multi-server / already using Postgres' },
    { key: 'mongodb', label: 'MongoDB', scenario: 'multi10k', useCase: 'Multi-server / NoSQL infrastructure' },
    { key: 'mysql', label: 'MySQL', scenario: 'multi10k', useCase: 'Multi-server / existing MySQL' },
  ]

  for (const cfg of storeConfig) {
    const storeData = data.bun[cfg.key]
    if (!storeData) continue
    const scenario = storeData[cfg.scenario]
    if (!scenario) continue

    lines.push(
      `| ${cfg.label} | ${formatOpsComma(scenario.opsPerSec)} | ${formatLatency(scenario.latencyAvgNs)} | ${cfg.useCase} |`
    )
  }

  return lines.join('\n')
}

function generateNodeCompetitorTable(data: OutputJson): string {
  const lines: string[] = ['| Library | Ops/sec | |', '|---------|---------|---|']

  const entries: { label: string; ops: number; bold: boolean }[] = []

  const hitlimitOps = data.node.memory?.multi10k?.opsPerSec
  if (hitlimitOps) {
    entries.push({ label: 'hitlimit', ops: hitlimitOps, bold: true })
  }

  const rlfOps = data.competitors.rateLimiterFlexible.memory?.multi10k?.opsPerSec
  if (rlfOps) {
    entries.push({ label: 'rate-limiter-flexible', ops: rlfOps, bold: false })
  }

  const erlOps = data.competitors.expressRateLimit.memory?.multi10k?.opsPerSec
  if (erlOps) {
    entries.push({ label: 'express-rate-limit', ops: erlOps, bold: false })
  }

  // Sort descending by ops
  entries.sort((a, b) => b.ops - a.ops)

  const maxOps = entries[0]?.ops || 1

  for (const entry of entries) {
    const label = entry.bold ? `**${entry.label}**` : entry.label
    const opsStr = entry.bold ? `**${formatOpsComma(entry.ops)}**` : formatOpsComma(entry.ops)
    const bar = generateBarChart(entry.ops, maxOps)
    lines.push(`| ${label} | ${opsStr} | ${bar} |`)
  }

  return lines.join('\n')
}

function generateBunVsNodeTable(data: OutputJson): string {
  const lines: string[] = ['| Runtime | Ops/sec | |', '|---------|---------|---|']

  const bunOps = data.bun.memory?.multi10k?.opsPerSec || 0
  const nodeOps = data.node.memory?.multi10k?.opsPerSec || 0
  const maxOps = Math.max(bunOps, nodeOps)

  if (bunOps > 0) {
    lines.push(`| **Bun** | **${formatOpsComma(bunOps)}** | ${generateBarChart(bunOps, maxOps)} |`)
  }
  if (nodeOps > 0) {
    lines.push(`| Node.js | ${formatOpsComma(nodeOps)} | ${generateBarChart(nodeOps, maxOps)} |`)
  }

  return lines.join('\n')
}

function generateBunVsNodeText(data: OutputJson): string {
  const bunMulti10k = data.bun.memory?.multi10k
  const nodeMulti10k = data.node.memory?.multi10k
  const bunSingle = data.bun.memory?.singleIp
  const nodeSingle = data.node.memory?.singleIp

  if (!bunMulti10k || !nodeMulti10k) return ''

  let text = `Bun leads at 10K IPs (${formatOps(bunMulti10k.opsPerSec)} vs ${formatOps(nodeMulti10k.opsPerSec)})`

  if (bunSingle && nodeSingle) {
    text += ` and single-IP (${formatOps(bunSingle.opsPerSec)} vs ${formatOps(nodeSingle.opsPerSec)})`
  }

  text +=
    '. Same library, same algorithm, **memory store**. For Redis, Postgres, and cross-store breakdowns, see the [full benchmark results](https://github.com/JointOps/hitlimit-monorepo/tree/main/benchmarks). Controlled-environment microbenchmarks with transparent methodology. Run them yourself.'

  return text
}

function generateExamples(data: OutputJson): string {
  const lines: string[] = ['**Example values:**']

  const memorySingle = data.node.memory?.singleIp
  if (memorySingle) {
    lines.push(
      `- \`${formatOpsComma(memorySingle.opsPerSec)} ops/sec\` \u2014 ${formatOps(memorySingle.opsPerSec).replace('M', ' million').replace('K', ' thousand')} checks per second (memory store, very fast)`
    )
  }

  const redisSingle = data.node.redis?.singleIp || data.node.redis?.multi10k
  if (redisSingle) {
    lines.push(
      `- \`${formatOpsComma(redisSingle.opsPerSec)} ops/sec\` \u2014 ${formatOps(redisSingle.opsPerSec).replace('M', ' million').replace('K', ' thousand')} checks per second (Redis store, network overhead)`
    )
  }

  const pgSingle = data.node.postgres?.singleIp || data.node.postgres?.multi10k
  if (pgSingle) {
    lines.push(
      `- \`${formatOpsComma(pgSingle.opsPerSec)} ops/sec\` \u2014 ${formatOps(pgSingle.opsPerSec).replace('M', ' million').replace('K', ' thousand')} checks per second (Postgres store, database overhead)`
    )
  }

  return lines.join('\n')
}

// Map of marker names to generator functions
type GeneratorMap = Record<string, (data: OutputJson) => string>

const GENERATORS: GeneratorMap = {
  NODE_HERO: generateNodeHero,
  BUN_HERO: generateBunHero,
  NODE_STORE_TABLE: generateNodeStoreTable,
  BUN_STORE_TABLE: generateBunStoreTable,
  NODE_COMPETITOR_TABLE: generateNodeCompetitorTable,
  BUN_VS_NODE_TABLE: generateBunVsNodeTable,
  BUN_VS_NODE_TEXT: generateBunVsNodeText,
  EXAMPLES: generateExamples,
}

function updateReadme(filePath: string, data: OutputJson): boolean {
  if (!fs.existsSync(filePath)) {
    console.log(`  Skipping ${path.basename(filePath)} (not found)`)
    return false
  }

  let content = fs.readFileSync(filePath, 'utf-8')
  let changed = false

  for (const [marker, generator] of Object.entries(GENERATORS)) {
    const openTag = `<!-- BENCH:${marker} -->`
    const closeTag = `<!-- /BENCH:${marker} -->`

    const openIdx = content.indexOf(openTag)
    const closeIdx = content.indexOf(closeTag)

    if (openIdx === -1 || closeIdx === -1) continue
    if (closeIdx <= openIdx) continue

    const before = content.slice(0, openIdx + openTag.length)
    const after = content.slice(closeIdx)
    const generated = generator(data)

    content = `${before}\n${generated}\n${after}`
    changed = true
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`  Updated ${path.relative(ROOT, filePath)}`)
  } else {
    console.log(`  No markers found in ${path.relative(ROOT, filePath)}`)
  }

  return changed
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log('Generating benchmark data...\n')

  // 1. Find latest version
  const latestVersion = findLatestVersion()
  console.log(`Latest version: ${latestVersion}`)

  // 2. Load results
  const results = loadResults(latestVersion)
  console.log(`Loaded ${results.length} result files from ${latestVersion}\n`)

  // 3. Build output JSON
  const output = buildOutputJson(results, latestVersion)

  // 4. Write JSON
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true })
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2) + '\n', 'utf-8')
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_JSON)}`)

  // 5. Update READMEs
  console.log('\nUpdating READMEs...')
  for (const readme of README_FILES) {
    updateReadme(readme, output)
  }

  console.log('\nDone.')
}

main()
