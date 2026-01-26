import { runBenchmark, formatResults, type BenchmarkResult } from '../tools/runner.js'

// Import from built package
const { redisStore } = await import('../../packages/hitlimit/dist/stores/redis.js')

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  console.log('Redis Store Benchmarks')
  console.log('======================')
  console.log(`Redis URL: ${redisUrl}\n`)

  const results: BenchmarkResult[] = []

  try {
    // Single key benchmark
    const singleKey = await runBenchmark(
      'Redis Store - Single Key',
      async () => {
        const store = redisStore({ url: redisUrl })
        return async () => {
          await store.hit('benchmark:user:123', 60000, 100)
        }
      },
      10_000 // Fewer iterations for Redis
    )
    results.push(singleKey)

    // Multiple keys benchmark
    const multiKey = await runBenchmark(
      'Redis Store - 1,000 Keys',
      async () => {
        const store = redisStore({ url: redisUrl })
        let keyIndex = 0
        return async () => {
          await store.hit(`benchmark:user:${keyIndex++ % 1000}`, 60000, 100)
        }
      },
      10_000
    )
    results.push(multiKey)

    formatResults(results)
  } catch (error) {
    console.error('Redis benchmark failed. Is Redis running?')
    console.error('Start Redis: docker run -p 6379:6379 redis:7-alpine')
    console.error(error)
  }

  return results
}

main().catch(console.error)

export { main as runRedisBenchmarks }
