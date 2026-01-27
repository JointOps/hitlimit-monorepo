/**
 * Node.js benchmark runner
 *
 * Comprehensive benchmarks comparing hitlimit vs competitors across all stores
 * 100% honest results - only reports what actually runs
 */

import { performance } from 'perf_hooks'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
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
    fn: (req: any, res: any, next: () => void) => void | Promise<void>
    cleanup?: () => void | Promise<void>
  } | null>
}

interface Scenario {
  name: string
  description: string
  generateRequest: (i: number) => { req: any; res: any; next: () => void }
}

// Store types to test
const STORES: (keyof StoreSupport)[] = ['memory', 'sqlite', 'redis']

// Scenarios
const scenarios: Scenario[] = [
  {
    name: 'single-ip',
    description: 'Single IP hammering the API (worst case for that IP)',
    generateRequest: (i: number) => ({
      req: { ip: '192.168.1.1', socket: { remoteAddress: '192.168.1.1' } },
      res: createMockResponse(),
      next: () => {}
    })
  },
  {
    name: 'multi-ip-1k',
    description: '1,000 unique IPs (typical small-medium API)',
    generateRequest: (i: number) => {
      const idx = i % 1000
      const ip = `10.0.${Math.floor(idx / 256)}.${idx % 256}`
      return {
        req: { ip, socket: { remoteAddress: ip } },
        res: createMockResponse(),
        next: () => {}
      }
    }
  },
  {
    name: 'multi-ip-10k',
    description: '10,000 unique IPs (high-traffic API)',
    generateRequest: (i: number) => {
      const idx = i % 10000
      const ip = `10.${Math.floor(idx / 65536) % 256}.${Math.floor(idx / 256) % 256}.${idx % 256}`
      return {
        req: { ip, socket: { remoteAddress: ip } },
        res: createMockResponse(),
        next: () => {}
      }
    }
  }
]

function createMockResponse() {
  const headers: Record<string, any> = {}
  return {
    statusCode: 200,
    setHeader: (name: string, value: any) => { headers[name] = value },
    status: (code: number) => ({ json: (body: any) => {} }),
    json: (body: any) => {},
    headers
  }
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

// Competitors with store support
const competitors: Competitor[] = [
  {
    name: 'hitlimit',
    stores: { memory: true, sqlite: true, redis: true },
    setup: async (store) => {
      try {
        if (store === 'memory') {
          const { memoryStore } = await import('../../../packages/hitlimit/dist/stores/memory.js')
          const { hitlimit } = await import('../../../packages/hitlimit/dist/index.js')
          const storeInstance = memoryStore()
          return {
            fn: hitlimit({ limit: 1_000_000, window: '1m', store: storeInstance }),
            cleanup: () => storeInstance.shutdown?.()
          }
        }
        if (store === 'sqlite') {
          const { sqliteStore } = await import('../../../packages/hitlimit/dist/stores/sqlite.js')
          const { hitlimit } = await import('../../../packages/hitlimit/dist/index.js')
          const storeInstance = sqliteStore({ path: ':memory:' })
          return {
            fn: hitlimit({ limit: 1_000_000, window: '1m', store: storeInstance }),
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
  },
  {
    name: 'express-rate-limit',
    stores: { memory: true, sqlite: false, redis: false },
    setup: async (store) => {
      if (store !== 'memory') return null
      try {
        const { rateLimit } = await import('express-rate-limit')
        const limiter = rateLimit({
          windowMs: 60_000,
          max: 1_000_000,
          standardHeaders: true,
          legacyHeaders: false
        })
        return {
          fn: (req: any, res: any, next: () => void) => limiter(req, res, next),
          cleanup: () => {}
        }
      } catch {
        return null
      }
    }
  },
  {
    name: 'rate-limiter-flexible',
    stores: { memory: true, sqlite: false, redis: true },
    setup: async (store) => {
      try {
        if (store === 'memory') {
          const { RateLimiterMemory } = await import('rate-limiter-flexible')
          const limiter = new RateLimiterMemory({ points: 1_000_000, duration: 60 })
          return {
            fn: async (req: any, res: any, next: () => void) => {
              try {
                await limiter.consume(req.ip)
                next()
              } catch {
                res.status(429)
              }
            },
            cleanup: () => {}
          }
        }
        if (store === 'redis') {
          // Redis requires a running server - skip for now
          return null
        }
      } catch {
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
  fn: (req: any, res: any, next: () => void) => void | Promise<void>,
  options = { iterations: 50_000, warmupIterations: 5_000, runs: 5 }
): Promise<BenchmarkResult> {
  // Warmup
  console.log(`      Warming up (${options.warmupIterations} iterations)...`)
  for (let i = 0; i < options.warmupIterations; i++) {
    const { req, res, next } = scenario.generateRequest(i)
    await fn(req, res, next)
  }

  // Force GC if available
  if (global.gc) global.gc()
  const memBefore = process.memoryUsage().heapUsed

  const allLatencies: number[] = []

  for (let run = 0; run < options.runs; run++) {
    console.log(`      Run ${run + 1}/${options.runs}...`)
    for (let i = 0; i < options.iterations; i++) {
      const { req, res, next } = scenario.generateRequest(i)
      const start = performance.now()
      await fn(req, res, next)
      const end = performance.now()
      allLatencies.push((end - start) * 1_000_000)
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
    runtime: 'node',
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

function generateReport(results: BenchmarkResult[], storeSupport: Map<string, StoreSupport>): string {
  let report = `
================================================================================
BENCHMARK RESULTS - Node.js ${process.version}
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

function generateMarkdown(results: BenchmarkResult[], storeSupport: Map<string, StoreSupport>): string {
  let md = `# Node.js Benchmark Results

**Generated:** ${new Date().toISOString()}
**Node.js:** ${process.version}
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
      md += `| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |\n`
      md += `|---------|---------|-----|-----|-----|-----|------------|\n`

      const sorted = [...scenarioResults].sort((a, b) => b.opsPerSec - a.opsPerSec)
      const fastest = sorted[0]

      for (const r of sorted) {
        const pct = r === fastest ? '**fastest**' : `${Math.round((r.opsPerSec / fastest.opsPerSec) * 100)}%`
        md += `| ${r.name} | ${formatOps(r.opsPerSec)} | ${formatLatency(r.avgLatencyNs)} | ${formatLatency(r.p50LatencyNs)} | ${formatLatency(r.p95LatencyNs)} | ${formatLatency(r.p99LatencyNs)} | ${pct} |\n`
      }
      md += '\n'
    }
  }

  return md
}

async function main() {
  console.log(`
========================================
hitlimit Node.js Benchmarks
========================================
Node.js ${process.version}
Platform: ${process.platform} ${process.arch}
`)

  const results: BenchmarkResult[] = []
  const storeSupport = new Map<string, StoreSupport>()

  for (const comp of competitors) {
    storeSupport.set(comp.name, comp.stores)
  }

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

          const { fn, cleanup } = setup
          const result = await runBenchmark(competitor.name, scenario, store, fn)
          results.push(result)

          console.log(`    ${formatOps(result.opsPerSec)} ops/sec, avg: ${formatLatency(result.avgLatencyNs)}`)

          if (cleanup) await cleanup()
        } catch (error: any) {
          console.log(`    Error: ${error.message}`)
        }
      }
    }
  }

  // Generate reports
  console.log(generateReport(results, storeSupport))

  // Save results
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true })
  }

  writeFileSync(
    join(resultsDir, 'node-latest.json'),
    JSON.stringify({
      metadata: {
        nodeVersion: process.version,
        platform: `${process.platform} ${process.arch}`,
        date: new Date().toISOString()
      },
      storeSupport: Object.fromEntries(storeSupport),
      results
    }, null, 2)
  )

  writeFileSync(
    join(resultsDir, 'node-latest.md'),
    generateMarkdown(results, storeSupport)
  )

  console.log(`\nResults saved to ${resultsDir}`)
}

main().catch(console.error)
