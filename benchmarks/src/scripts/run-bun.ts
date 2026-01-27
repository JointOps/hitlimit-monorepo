/**
 * Bun benchmark runner
 *
 * Comprehensive benchmarks for hitlimit-bun across all stores
 * 100% honest results - only reports what actually runs
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'

// @ts-ignore - Bun globals
const __dirname = dirname(Bun.main)
const resultsDir = join(__dirname, '..', '..', 'results')

interface BenchmarkResult {
  name: string
  scenario: string
  store: string
  runtime: 'node' | 'bun'
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

interface StoreSupport {
  memory: boolean
  sqlite: boolean
  redis: boolean
}

interface Competitor {
  name: string
  stores: StoreSupport
  setup: (store: keyof StoreSupport) => Promise<{
    hit: (key: string) => any
    cleanup?: () => void
  } | null>
}

interface Scenario {
  name: string
  description: string
  generateKey: (iteration: number) => string
}

// Store types to test
const STORES: (keyof StoreSupport)[] = ['memory', 'sqlite', 'redis']

// Scenarios
const scenarios: Scenario[] = [
  {
    name: 'single-ip',
    description: 'Single IP hammering the API (worst case for that IP)',
    generateKey: () => '192.168.1.1'
  },
  {
    name: 'multi-ip-1k',
    description: '1,000 unique IPs (typical small-medium API)',
    generateKey: (i) => `10.0.${Math.floor((i % 1000) / 256)}.${(i % 1000) % 256}`
  },
  {
    name: 'multi-ip-10k',
    description: '10,000 unique IPs (high-traffic API)',
    generateKey: (i) => {
      const idx = i % 10000
      return `10.${Math.floor(idx / 65536) % 256}.${Math.floor(idx / 256) % 256}.${idx % 256}`
    }
  }
]

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

// Competitors with store support
const competitors: Competitor[] = [
  {
    name: 'hitlimit-bun',
    stores: { memory: true, sqlite: true, redis: true },
    setup: async (store) => {
      try {
        if (store === 'memory') {
          const { memoryStore } = await import('../../../packages/hitlimit-bun/dist/stores/memory.js')
          const storeInstance = memoryStore()
          return {
            hit: (key: string) => storeInstance.hit(key, 60000, 1_000_000),
            cleanup: () => storeInstance.shutdown?.()
          }
        }
        if (store === 'sqlite') {
          const { sqliteStore } = await import('../../../packages/hitlimit-bun/dist/stores/sqlite.js')
          const storeInstance = sqliteStore({ path: ':memory:' })
          return {
            hit: (key: string) => storeInstance.hit(key, 60000, 1_000_000),
            cleanup: () => storeInstance.shutdown?.()
          }
        }
        if (store === 'redis') {
          // Redis requires a running server - skip for now
          return null
        }
      } catch (e: any) {
        console.log(`      Setup failed: ${e.message}`)
        return null
      }
      return null
    }
  }
]

async function runBenchmark(
  name: string,
  scenario: Scenario,
  store: string,
  hit: (key: string) => any,
  options = { iterations: 10_000, warmupIterations: 1_000, runs: 3 }
): Promise<BenchmarkResult> {
  // Warmup
  console.log(`      Warming up...`)
  for (let i = 0; i < options.warmupIterations; i++) {
    const key = scenario.generateKey(i)
    hit(key)
  }

  // Force GC
  Bun.gc(true)
  const memBefore = process.memoryUsage().heapUsed

  const allLatencies: number[] = []

  for (let run = 0; run < options.runs; run++) {
    console.log(`      Run ${run + 1}/${options.runs}...`)

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
    store,
    runtime: 'bun',
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

function generateReport(results: BenchmarkResult[]): string {
  let report = `
================================================================================
BENCHMARK RESULTS - Bun ${Bun.version}
================================================================================
Platform: ${process.platform} ${process.arch}
Date: ${new Date().toISOString()}

`

  // Group by store
  for (const store of STORES) {
    const storeResults = results.filter(r => r.store === store)
    if (storeResults.length === 0) continue

    report += `
${'='.repeat(80)}
STORE: ${store.toUpperCase()}
${'='.repeat(80)}

Store Support:
`
    for (const comp of competitors) {
      const supported = comp.stores[store]
      report += `  ${comp.name}: ${supported ? '✓ Supported' : '✗ Not supported'}\n`
    }

    // Group by scenario
    for (const scenario of scenarios) {
      const scenarioResults = storeResults.filter(r => r.scenario === scenario.name)
      if (scenarioResults.length === 0) continue

      report += `
[${scenario.name}] ${scenario.description}
${'-'.repeat(60)}
`
      const sorted = [...scenarioResults].sort((a, b) => b.opsPerSec - a.opsPerSec)
      const fastest = sorted[0]

      for (const r of sorted) {
        const pct = r === fastest ? '(fastest)' : `(${Math.round((r.opsPerSec / fastest.opsPerSec) * 100)}%)`
        report += `  ${r.name}
    Throughput: ${formatOps(r.opsPerSec)} ops/sec ${pct}
    Latency:    avg=${formatLatency(r.avgLatencyNs)} p50=${formatLatency(r.p50LatencyNs)} p95=${formatLatency(r.p95LatencyNs)} p99=${formatLatency(r.p99LatencyNs)}
    Memory:     ${r.memoryUsedMB.toFixed(2)} MB
    +/- ${formatLatency(r.marginOfError)} (95% CI)

`
      }
    }
  }

  return report
}

function generateMarkdown(results: BenchmarkResult[]): string {
  let md = `# Bun Benchmark Results

**Generated:** ${new Date().toISOString()}
**Bun:** ${Bun.version}
**Platform:** ${process.platform} ${process.arch}

## Store Support Matrix

| Library | Memory | SQLite | Redis |
|---------|--------|--------|-------|
`
  for (const comp of competitors) {
    md += `| ${comp.name} | ${comp.stores.memory ? '✓' : '✗'} | ${comp.stores.sqlite ? '✓' : '✗'} | ${comp.stores.redis ? '✓' : '✗'} |\n`
  }

  // Group by store
  for (const store of STORES) {
    const storeResults = results.filter(r => r.store === store)
    if (storeResults.length === 0) continue

    md += `\n## ${store.charAt(0).toUpperCase() + store.slice(1)} Store\n\n`

    for (const scenario of scenarios) {
      const scenarioResults = storeResults.filter(r => r.scenario === scenario.name)
      if (scenarioResults.length === 0) continue

      md += `### ${scenario.name}\n\n`
      md += `| Library | ops/sec | avg | p50 | p95 | p99 |\n`
      md += `|---------|---------|-----|-----|-----|-----|\n`

      const sorted = [...scenarioResults].sort((a, b) => b.opsPerSec - a.opsPerSec)

      for (const r of sorted) {
        md += `| ${r.name} | ${formatOps(r.opsPerSec)} | ${formatLatency(r.avgLatencyNs)} | ${formatLatency(r.p50LatencyNs)} | ${formatLatency(r.p95LatencyNs)} | ${formatLatency(r.p99LatencyNs)} |\n`
      }
      md += '\n'
    }
  }

  return md
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

  // Run benchmarks for each store type
  for (const store of STORES) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`STORE: ${store.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)

    for (const scenario of scenarios) {
      console.log(`\n[${scenario.name}] ${scenario.description}`)
      console.log('-'.repeat(50))

      for (const competitor of competitors) {
        if (!competitor.stores[store]) {
          console.log(`  ${competitor.name}... SKIPPED (store not supported)`)
          continue
        }

        console.log(`  ${competitor.name}...`)

        try {
          const setup = await competitor.setup(store)
          if (!setup) {
            console.log(`    Skipped: Setup returned null`)
            continue
          }

          const { hit, cleanup } = setup
          const result = await runBenchmark(competitor.name, scenario, store, hit)
          results.push(result)

          console.log(`    ${formatOps(result.opsPerSec)} ops/sec, avg: ${formatLatency(result.avgLatencyNs)}`)

          if (cleanup) cleanup()
        } catch (error: any) {
          console.log(`    Error: ${error.message}`)
        }
      }
    }
  }

  // Generate reports
  console.log(generateReport(results))

  // Save results
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true })
  }

  const storeSupport: Record<string, StoreSupport> = {}
  for (const comp of competitors) {
    storeSupport[comp.name] = comp.stores
  }

  writeFileSync(
    join(resultsDir, 'bun-latest.json'),
    JSON.stringify({
      metadata: {
        bunVersion: Bun.version,
        platform: `${process.platform} ${process.arch}`,
        date: new Date().toISOString()
      },
      storeSupport,
      results
    }, null, 2)
  )

  writeFileSync(
    join(resultsDir, 'bun-latest.md'),
    generateMarkdown(results)
  )

  console.log(`\nResults saved to ${resultsDir}`)
}

main().catch(console.error)
