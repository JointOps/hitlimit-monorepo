/**
 * Node.js benchmark runner
 *
 * Runs comprehensive benchmarks comparing hitlimit vs competitors
 */

import { performance } from 'perf_hooks'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { calculateStats, formatOps, formatLatency, BenchmarkResult, DEFAULT_OPTIONS, RunOptions } from '../utils/stats.js'
import { generateConsoleReport, generateMarkdownReport, generateJSONReport, ReportMetadata } from '../utils/reporter.js'
import { scenarios } from '../scenarios/index.js'
import { createMockRequest, createMockResponse } from '../utils/mock-express.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resultsDir = join(__dirname, '..', '..', 'results')

interface Competitor {
  name: string
  setup: () => Promise<{
    fn: (req: any, res: any, next: () => void) => void | Promise<void>
    cleanup?: () => void | Promise<void>
  }>
}

const competitors: Competitor[] = [
  {
    name: 'hitlimit',
    setup: async () => {
      const { memoryStore } = await import('../../../packages/hitlimit/dist/stores/memory.js')
      const { hitlimit } = await import('../../../packages/hitlimit/dist/index.js')

      const limiter = hitlimit({
        limit: 1_000_000,  // High limit to test throughput
        window: '1m',
        store: memoryStore()
      })

      return {
        fn: limiter,
        cleanup: () => {}
      }
    }
  },
  {
    name: 'hitlimit (tiered)',
    setup: async () => {
      const { memoryStore } = await import('../../../packages/hitlimit/dist/stores/memory.js')
      const { hitlimit } = await import('../../../packages/hitlimit/dist/index.js')

      const limiter = hitlimit({
        tiers: {
          free: { limit: 100, window: '1m' },
          pro: { limit: 5000, window: '1m' },
          enterprise: { limit: 1_000_000, window: '1m' }
        },
        tier: (req: any) => req.user?.plan || 'free',
        store: memoryStore()
      })

      return {
        fn: limiter,
        cleanup: () => {}
      }
    }
  },
  {
    name: 'express-rate-limit',
    setup: async () => {
      try {
        const { rateLimit } = await import('express-rate-limit')

        const limiter = rateLimit({
          windowMs: 60_000,
          max: 1_000_000,
          standardHeaders: true,
          legacyHeaders: false
        })

        return {
          fn: (req: any, res: any, next: () => void) => {
            limiter(req, res, next)
          },
          cleanup: () => {}
        }
      } catch {
        throw new Error('express-rate-limit not installed')
      }
    }
  },
  {
    name: 'rate-limiter-flexible',
    setup: async () => {
      try {
        const { RateLimiterMemory } = await import('rate-limiter-flexible')

        const limiter = new RateLimiterMemory({
          points: 1_000_000,
          duration: 60
        })

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
      } catch {
        throw new Error('rate-limiter-flexible not installed')
      }
    }
  }
]

async function runBenchmark(
  name: string,
  scenario: typeof scenarios[0],
  fn: (req: any, res: any, next: () => void) => void | Promise<void>,
  options: Partial<RunOptions> = {}
): Promise<BenchmarkResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Warmup
  console.log(`    Warming up (${opts.warmupIterations} iterations)...`)
  for (let i = 0; i < opts.warmupIterations; i++) {
    const { req, res, next } = scenario.generateRequest(i)
    await fn(req, res, next)
  }

  // Force GC if available
  if (global.gc) global.gc()
  const memBefore = process.memoryUsage().heapUsed

  // Collect latencies across all runs
  const allLatencies: number[] = []

  for (let run = 0; run < opts.runs; run++) {
    console.log(`    Run ${run + 1}/${opts.runs}...`)

    for (let i = 0; i < opts.iterations; i++) {
      const { req, res, next } = scenario.generateRequest(i)

      const start = performance.now()
      await fn(req, res, next)
      const end = performance.now()

      allLatencies.push((end - start) * 1_000_000)  // Convert to ns
    }
  }

  const memAfter = process.memoryUsage().heapUsed
  const stats = calculateStats(allLatencies)
  const totalIterations = opts.iterations * opts.runs
  const totalNs = allLatencies.reduce((a, b) => a + b, 0)
  const totalMs = totalNs / 1_000_000

  return {
    name,
    scenario: scenario.name,
    runtime: 'node',
    store: 'memory',
    iterations: totalIterations,
    runs: opts.runs,
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
hitlimit Node.js Benchmarks
========================================
Node.js ${process.version}
Platform: ${process.platform} ${process.arch}
`)

  // Only run a subset of scenarios for faster feedback
  const selectedScenarios = scenarios.filter(s =>
    ['single-ip', 'multi-ip-1k', 'multi-ip-10k'].includes(s.name)
  )

  const results: BenchmarkResult[] = []

  for (const scenario of selectedScenarios) {
    console.log(`\n[${scenario.name}] ${scenario.description}`)
    console.log('-'.repeat(50))

    for (const competitor of competitors) {
      console.log(`  ${competitor.name}...`)

      try {
        const { fn, cleanup } = await competitor.setup()
        const result = await runBenchmark(
          competitor.name,
          scenario,
          fn,
          { iterations: 10_000, warmupIterations: 1_000, runs: 3 }
        )
        results.push(result)

        console.log(`    ${formatOps(result.opsPerSec)} ops/sec, avg: ${formatLatency(result.avgLatencyNs)}`)

        if (cleanup) await cleanup()
      } catch (error: any) {
        console.log(`    Skipped: ${error.message}`)
      }
    }
  }

  // Generate reports
  const metadata: ReportMetadata = {
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    date: new Date().toISOString()
  }

  console.log(generateConsoleReport(results))

  // Save results
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true })
  }

  writeFileSync(
    join(resultsDir, 'node-latest.json'),
    generateJSONReport(results, metadata)
  )

  writeFileSync(
    join(resultsDir, 'node-latest.md'),
    generateMarkdownReport(results, metadata)
  )

  console.log(`\nResults saved to ${resultsDir}`)
}

main().catch(console.error)
