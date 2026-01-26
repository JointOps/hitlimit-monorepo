/**
 * hitlimit vs express-rate-limit Benchmark
 *
 * Compares hitlimit performance against express-rate-limit
 * Run with: npx tsx benchmarks/comparison/vs-express-rate-limit.bench.ts
 */

import { runBenchmark, formatResults, saveResults } from '../tools/runner'

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║            hitlimit vs express-rate-limit                     ║
╚══════════════════════════════════════════════════════════════╝
`)

  const results = []

  // hitlimit Memory Store
  console.log('Benchmarking: hitlimit (Memory Store)...')
  const hitlimitMemory = await runBenchmark(
    'hitlimit - Memory',
    async () => {
      const { memoryStore } = await import('hitlimit/stores/memory')
      const store = memoryStore()
      return async () => {
        await store.hit('user:123', 60000, 100)
      }
    }
  )
  results.push(hitlimitMemory)
  console.log(`  ${hitlimitMemory.opsPerSecond.toLocaleString()} ops/sec`)

  // express-rate-limit
  console.log('Benchmarking: express-rate-limit (Memory Store)...')
  try {
    const expressRateLimitMemory = await runBenchmark(
      'express-rate-limit - Memory',
      async () => {
        const { rateLimit } = await import('express-rate-limit')

        // Create a limiter instance
        const limiter = rateLimit({
          windowMs: 60 * 1000,
          max: 100,
          standardHeaders: true,
          legacyHeaders: false
        })

        // Mock request and response for benchmarking the core logic
        const mockReq = {
          ip: '127.0.0.1',
          headers: {},
          socket: { remoteAddress: '127.0.0.1' }
        } as any

        const mockRes = {
          setHeader: () => {},
          status: () => ({ json: () => {} }),
          locals: {}
        } as any

        const mockNext = () => {}

        return async () => {
          await new Promise<void>((resolve) => {
            limiter(mockReq, mockRes, () => resolve())
          })
        }
      }
    )
    results.push(expressRateLimitMemory)
    console.log(`  ${expressRateLimitMemory.opsPerSecond.toLocaleString()} ops/sec`)
  } catch (error) {
    console.log('  express-rate-limit not installed. Run: npm install express-rate-limit')
    results.push({
      name: 'express-rate-limit - Memory',
      opsPerSecond: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      memoryUsedMB: 0
    })
  }

  // hitlimit Redis Store
  if (process.env.REDIS_URL) {
    console.log('Benchmarking: hitlimit (Redis Store)...')
    const hitlimitRedis = await runBenchmark(
      'hitlimit - Redis',
      async () => {
        const { redisStore } = await import('hitlimit/stores/redis')
        const store = redisStore({ url: process.env.REDIS_URL! })
        return async () => {
          await store.hit('user:123', 60000, 100)
        }
      },
      50000 // Fewer iterations for Redis
    )
    results.push(hitlimitRedis)
    console.log(`  ${hitlimitRedis.opsPerSecond.toLocaleString()} ops/sec`)
  }

  // Print results
  console.log('\n' + formatResults(results))

  // Calculate speedup
  const hitlimit = results.find(r => r.name === 'hitlimit - Memory')
  const expressRL = results.find(r => r.name === 'express-rate-limit - Memory')

  if (hitlimit && expressRL && expressRL.opsPerSecond > 0) {
    const speedup = (hitlimit.opsPerSecond / expressRL.opsPerSecond).toFixed(1)
    console.log(`\n⚡ hitlimit is ${speedup}x faster than express-rate-limit\n`)
  }

  // Save results
  await saveResults(results, 'benchmarks/results/comparison-express-rate-limit.json')
}

main().catch(console.error)
