/**
 * Bun benchmark runner
 *
 * Runs comprehensive benchmarks for hitlimit-bun
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'

// @ts-ignore - Bun globals
const __dirname = dirname(Bun.main)
const resultsDir = join(__dirname, '..', '..', 'results')

interface BenchmarkResult {
  name: string
  scenario: string
  runtime: 'node' | 'bun'
  store: string
  iterations: number
  runs: number
  totalMs: number
  opsPerSec: number
  avgLatencyNs: number
  p50LatencyNs: number
  p95LatencyNs: number
  p99LatencyNs: number
  minLatencyNs: number
  maxLatencyNs: number
  stdDev: number
  marginOfError: number
  memoryUsedMB: number
}

interface ReportMetadata {
  bunVersion: string
  platform: string
  date: string
}

function calculateStats(latencies: number[]) {
  const sorted = [...latencies].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const squaredDiffs = sorted.map(x => Math.pow(x - mean, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n
  const stdDev = Math.sqrt(variance)
  const marginOfError = (1.96 * stdDev) / Math.sqrt(n)

  return {
    avg: mean,
    p50: sorted[Math.floor(n * 0.5)],
    p95: sorted[Math.floor(n * 0.95)],
    p99: sorted[Math.floor(n * 0.99)],
    min: sorted[0],
    max: sorted[n - 1],
    stdDev,
    marginOfError
  }
}

function formatOps(ops: number): string {
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M`
  if (ops >= 1_000) return `${(ops / 1_000).toFixed(1)}K`
  return ops.toFixed(0)
}

function formatLatency(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(0)}ns`
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(2)}us`
  return `${(ns / 1_000_000).toFixed(2)}ms`
}

interface Scenario {
  name: string
  description: string
  generateKey: (iteration: number) => string
}

const scenarios: Scenario[] = [
  {
    name: 'single-ip',
    description: 'Single IP hammering the API',
    generateKey: () => '192.168.1.1'
  },
  {
    name: 'multi-ip-1k',
    description: '1,000 unique IPs',
    generateKey: (i) => `10.0.${Math.floor((i % 1000) / 256)}.${(i % 1000) % 256}`
  },
  {
    name: 'multi-ip-10k',
    description: '10,000 unique IPs',
    generateKey: (i) => {
      const idx = i % 10000
      return `10.${Math.floor(idx / 65536) % 256}.${Math.floor(idx / 256) % 256}.${idx % 256}`
    }
  }
]

interface Competitor {
  name: string
  store: string
  setup: () => Promise<{
    hit: (key: string) => any
    cleanup?: () => void
  }>
}

const competitors: Competitor[] = [
  {
    name: 'hitlimit-bun (memory)',
    store: 'memory',
    setup: async () => {
      const { memoryStore } = await import('../../../packages/hitlimit-bun/dist/stores/memory.js')
      const store = memoryStore()
      return {
        hit: (key: string) => store.hit(key, 60000, 1_000_000),
        cleanup: () => store.shutdown?.()
      }
    }
  },
  {
    name: 'hitlimit-bun (sqlite)',
    store: 'sqlite',
    setup: async () => {
      const { sqliteStore } = await import('../../../packages/hitlimit-bun/dist/stores/sqlite.js')
      const store = sqliteStore({ path: ':memory:' })
      return {
        hit: (key: string) => store.hit(key, 60000, 1_000_000),
        cleanup: () => store.shutdown?.()
      }
    }
  }
]

async function runBenchmark(
  name: string,
  scenario: Scenario,
  hit: (key: string) => any,
  options = { iterations: 10_000, warmupIterations: 1_000, runs: 3 }
): Promise<BenchmarkResult> {
  // Warmup
  console.log(`    Warming up...`)
  for (let i = 0; i < options.warmupIterations; i++) {
    const key = scenario.generateKey(i)
    hit(key)
  }

  // Force GC
  Bun.gc(true)
  const memBefore = process.memoryUsage().heapUsed

  const allLatencies: number[] = []

  for (let run = 0; run < options.runs; run++) {
    console.log(`    Run ${run + 1}/${options.runs}...`)

    for (let i = 0; i < options.iterations; i++) {
      const key = scenario.generateKey(i)

      const start = Bun.nanoseconds()
      hit(key)
      const end = Bun.nanoseconds()

      allLatencies.push(end - start)
    }
  }

  const memAfter = process.memoryUsage().heapUsed
  const stats = calculateStats(allLatencies)
  const totalIterations = options.iterations * options.runs
  const totalNs = allLatencies.reduce((a, b) => a + b, 0)
  const totalMs = totalNs / 1_000_000

  return {
    name,
    scenario: scenario.name,
    runtime: 'bun',
    store: 'memory',
    iterations: totalIterations,
    runs: options.runs,
    totalMs,
    opsPerSec: Math.round((totalIterations / totalMs) * 1000),
    avgLatencyNs: stats.avg,
    p50LatencyNs: stats.p50,
    p95LatencyNs: stats.p95,
    p99LatencyNs: stats.p99,
    minLatencyNs: stats.min,
    maxLatencyNs: stats.max,
    stdDev: stats.stdDev,
    marginOfError: stats.marginOfError,
    memoryUsedMB: (memAfter - memBefore) / 1024 / 1024
  }
}

async function main() {
  console.log(`
========================================
hitlimit-bun Benchmarks
========================================
Bun ${Bun.version}
Platform: ${process.platform} ${process.arch}
`)

  const results: BenchmarkResult[] = []

  for (const scenario of scenarios) {
    console.log(`\n[${scenario.name}] ${scenario.description}`)
    console.log('-'.repeat(50))

    for (const competitor of competitors) {
      console.log(`  ${competitor.name}...`)

      try {
        const { hit, cleanup } = await competitor.setup()
        const result = await runBenchmark(competitor.name, scenario, hit)
        result.store = competitor.store
        results.push(result)

        console.log(`    ${formatOps(result.opsPerSec)} ops/sec, avg: ${formatLatency(result.avgLatencyNs)}`)

        if (cleanup) cleanup()
      } catch (error: any) {
        console.log(`    Skipped: ${error.message}`)
      }
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))

  for (const scenario of scenarios) {
    const scenarioResults = results.filter(r => r.scenario === scenario.name)
    if (scenarioResults.length === 0) continue

    console.log(`\n[${scenario.name}]`)
    const sorted = [...scenarioResults].sort((a, b) => b.opsPerSec - a.opsPerSec)

    for (const r of sorted) {
      console.log(`  ${r.name}: ${formatOps(r.opsPerSec)} ops/sec`)
    }
  }

  // Save results
  const metadata: ReportMetadata = {
    bunVersion: Bun.version,
    platform: `${process.platform} ${process.arch}`,
    date: new Date().toISOString()
  }

  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true })
  }

  writeFileSync(
    join(resultsDir, 'bun-latest.json'),
    JSON.stringify({ metadata, results }, null, 2)
  )

  // Generate markdown
  let md = `# Bun Benchmark Results\n\n`
  md += `**Generated:** ${metadata.date}\n`
  md += `**Bun:** ${metadata.bunVersion}\n`
  md += `**Platform:** ${metadata.platform}\n\n`

  for (const scenario of scenarios) {
    const scenarioResults = results.filter(r => r.scenario === scenario.name)
    if (scenarioResults.length === 0) continue

    md += `## ${scenario.name}\n\n`
    md += `| Library | Store | ops/sec | avg | p95 | p99 |\n`
    md += `|---------|-------|---------|-----|-----|-----|\n`

    const sorted = [...scenarioResults].sort((a, b) => b.opsPerSec - a.opsPerSec)
    for (const r of sorted) {
      md += `| ${r.name} | ${r.store} | ${formatOps(r.opsPerSec)} | ${formatLatency(r.avgLatencyNs)} | ${formatLatency(r.p95LatencyNs)} | ${formatLatency(r.p99LatencyNs)} |\n`
    }
    md += `\n`
  }

  writeFileSync(join(resultsDir, 'bun-latest.md'), md)

  console.log(`\nResults saved to ${resultsDir}`)
}

main().catch(console.error)
