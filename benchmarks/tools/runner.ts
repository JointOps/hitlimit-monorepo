import { performance } from 'perf_hooks'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface BenchmarkResult {
  name: string
  opsPerSecond: number
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  memoryUsedMB: number
}

export async function runBenchmark(
  name: string,
  setup: () => Promise<() => Promise<void>>,
  iterations: number = 100_000
): Promise<BenchmarkResult> {
  const fn = await setup()
  const latencies: number[] = []

  // Warmup
  for (let i = 0; i < 1000; i++) {
    await fn()
  }

  // Force GC if available
  if (global.gc) global.gc()
  const memBefore = process.memoryUsage().heapUsed

  // Benchmark
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now()
    await fn()
    latencies.push(performance.now() - opStart)
  }
  const duration = performance.now() - start

  const memAfter = process.memoryUsage().heapUsed

  // Calculate percentiles
  latencies.sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.5)]
  const p95 = latencies[Math.floor(latencies.length * 0.95)]
  const p99 = latencies[Math.floor(latencies.length * 0.99)]

  return {
    name,
    opsPerSecond: Math.round(iterations / (duration / 1000)),
    avgLatencyMs: Number((duration / iterations).toFixed(4)),
    p50LatencyMs: Number(p50.toFixed(4)),
    p95LatencyMs: Number(p95.toFixed(4)),
    p99LatencyMs: Number(p99.toFixed(4)),
    memoryUsedMB: Number(((memAfter - memBefore) / 1024 / 1024).toFixed(2))
  }
}

export function formatResults(results: BenchmarkResult[]): void {
  console.log('\n' + '='.repeat(80))
  console.log('BENCHMARK RESULTS')
  console.log('='.repeat(80) + '\n')

  for (const r of results) {
    console.log(`${r.name}`)
    console.log('-'.repeat(50))
    console.log(`  Throughput:  ${r.opsPerSecond.toLocaleString()} ops/sec`)
    console.log(`  Avg Latency: ${r.avgLatencyMs}ms`)
    console.log(`  p50 Latency: ${r.p50LatencyMs}ms`)
    console.log(`  p95 Latency: ${r.p95LatencyMs}ms`)
    console.log(`  p99 Latency: ${r.p99LatencyMs}ms`)
    console.log(`  Memory:      ${r.memoryUsedMB}MB`)
    console.log()
  }
}

export function saveResults(results: BenchmarkResult[], filename: string): void {
  const resultsDir = join(__dirname, '..', 'results')
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true })
  }

  const data = {
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    results
  }

  writeFileSync(
    join(resultsDir, filename),
    JSON.stringify(data, null, 2)
  )
}
