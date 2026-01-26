/**
 * Bun Redis Store Benchmark
 *
 * Benchmark hitlimit-bun's Redis store.
 * Run with: bun benchmarks/bun/redis.bench.ts
 *
 * Prerequisites: Redis running on localhost:6379
 *   docker run -p 6379:6379 redis:7-alpine
 */

import { redisStore } from 'hitlimit-bun/stores/redis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const iterations = 50_000 // Fewer iterations for Redis due to network
const warmup = 100

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║               BUN REDIS STORE BENCHMARK                       ║
╚══════════════════════════════════════════════════════════════╝
`)

  console.log(`Connecting to Redis at: ${REDIS_URL}`)
  console.log('')

  const store = redisStore({ url: REDIS_URL })

  // Warmup
  console.log('Warming up...')
  for (let i = 0; i < warmup; i++) {
    await store.hit('warmup', 60000, 100)
  }

  // Force GC
  Bun.gc(true)

  // Single key benchmark
  console.log('Running benchmark...')
  const latencies: number[] = []
  const start = Bun.nanoseconds()

  for (let i = 0; i < iterations; i++) {
    const opStart = Bun.nanoseconds()
    await store.hit('user:123', 60000, 100)
    latencies.push((Bun.nanoseconds() - opStart) / 1_000_000) // ms
  }

  const duration = (Bun.nanoseconds() - start) / 1_000_000
  const ops = Math.round(iterations / (duration / 1000))

  // Calculate percentiles
  latencies.sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.5)]
  const p95 = latencies[Math.floor(latencies.length * 0.95)]
  const p99 = latencies[Math.floor(latencies.length * 0.99)]

  console.log(`
Bun Redis Store (Local)
───────────────────────
  Operations:  ${iterations.toLocaleString()}
  Duration:    ${(duration / 1000).toFixed(2)} seconds
  Throughput:  ${ops.toLocaleString()} ops/sec

  Latency Distribution:
    Avg:  ${(duration / iterations).toFixed(3)}ms
    P50:  ${p50.toFixed(3)}ms
    P95:  ${p95.toFixed(3)}ms
    P99:  ${p99.toFixed(3)}ms

Expected: ~15,000 ops/sec (local Redis)

Note: Redis performance is largely determined by network latency.
      Local Redis: ~15,000 ops/sec
      Remote Redis (1ms network): ~2,000-5,000 ops/sec
`)

  // Cleanup
  await store.reset('user:123')
  await store.reset('warmup')

  process.exit(0)
}

main().catch(error => {
  console.error('Benchmark failed:', error.message)
  console.log('')
  console.log('Make sure Redis is running:')
  console.log('  docker run -p 6379:6379 redis:7-alpine')
  process.exit(1)
})
