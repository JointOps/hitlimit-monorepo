/**
 * hitlimit vs rate-limiter-flexible Benchmark
 *
 * Compares hitlimit performance against rate-limiter-flexible
 * Run with: npx tsx benchmarks/comparison/vs-rate-limiter-flexible.bench.ts
 */

import { runBenchmark, formatResults, saveResults } from '../tools/runner'

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║            hitlimit vs rate-limiter-flexible                  ║
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

  // rate-limiter-flexible Memory
  console.log('Benchmarking: rate-limiter-flexible (Memory)...')
  try {
    const rlfMemory = await runBenchmark(
      'rate-limiter-flexible - Memory',
      async () => {
        const { RateLimiterMemory } = await import('rate-limiter-flexible')
        const limiter = new RateLimiterMemory({
          points: 100,
          duration: 60
        })

        return async () => {
          try {
            await limiter.consume('user:123')
          } catch {
            // Rate limited - still counts as operation
          }
        }
      }
    )
    results.push(rlfMemory)
    console.log(`  ${rlfMemory.opsPerSecond.toLocaleString()} ops/sec`)
  } catch (error) {
    console.log('  rate-limiter-flexible not installed. Run: npm install rate-limiter-flexible')
    results.push({
      name: 'rate-limiter-flexible - Memory',
      opsPerSecond: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      memoryUsedMB: 0
    })
  }

  // Redis comparisons if available
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
      50000
    )
    results.push(hitlimitRedis)
    console.log(`  ${hitlimitRedis.opsPerSecond.toLocaleString()} ops/sec`)

    console.log('Benchmarking: rate-limiter-flexible (Redis)...')
    try {
      const rlfRedis = await runBenchmark(
        'rate-limiter-flexible - Redis',
        async () => {
          const { RateLimiterRedis } = await import('rate-limiter-flexible')
          const { createClient } = await import('redis')

          const client = createClient({ url: process.env.REDIS_URL })
          await client.connect()

          const limiter = new RateLimiterRedis({
            storeClient: client,
            points: 100,
            duration: 60,
            keyPrefix: 'rlf-bench'
          })

          return async () => {
            try {
              await limiter.consume('user:123')
            } catch {
              // Rate limited
            }
          }
        },
        50000
      )
      results.push(rlfRedis)
      console.log(`  ${rlfRedis.opsPerSecond.toLocaleString()} ops/sec`)
    } catch (error) {
      console.log('  Could not benchmark rate-limiter-flexible with Redis')
    }
  }

  // Print results
  console.log('\n' + formatResults(results))

  // Calculate speedup
  const hitlimit = results.find(r => r.name === 'hitlimit - Memory')
  const rlf = results.find(r => r.name === 'rate-limiter-flexible - Memory')

  if (hitlimit && rlf && rlf.opsPerSecond > 0) {
    const speedup = (hitlimit.opsPerSecond / rlf.opsPerSecond).toFixed(1)
    console.log(`\n⚡ hitlimit is ${speedup}x faster than rate-limiter-flexible\n`)
  }

  // Save results
  await saveResults(results, 'benchmarks/results/comparison-rate-limiter-flexible.json')
}

main().catch(console.error)
