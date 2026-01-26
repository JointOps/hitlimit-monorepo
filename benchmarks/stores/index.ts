import { runBenchmark, formatResults, saveResults, type BenchmarkResult } from '../tools/runner.js'

console.log('='.repeat(80))
console.log('HITLIMIT STORE BENCHMARKS')
console.log('='.repeat(80))
console.log()
console.log('Environment:')
console.log(`  Node.js: ${process.version}`)
console.log(`  Platform: ${process.platform}`)
console.log(`  Arch: ${process.arch}`)
console.log()

const allResults: BenchmarkResult[] = []

// Memory Store
console.log('\n[1/3] Memory Store Benchmarks\n')
const { memoryStore } = await import('../../packages/hitlimit/dist/stores/memory.js')

const memorySingle = await runBenchmark(
  'Memory Store - Single Key',
  async () => {
    const store = memoryStore()
    return async () => {
      await store.hit('user:123', 60000, 100)
    }
  }
)
allResults.push(memorySingle)
console.log(`  ${memorySingle.name}: ${memorySingle.opsPerSecond.toLocaleString()} ops/sec`)

const memoryMulti = await runBenchmark(
  'Memory Store - 10,000 Keys',
  async () => {
    const store = memoryStore()
    let i = 0
    return async () => {
      await store.hit(`user:${i++ % 10000}`, 60000, 100)
    }
  }
)
allResults.push(memoryMulti)
console.log(`  ${memoryMulti.name}: ${memoryMulti.opsPerSecond.toLocaleString()} ops/sec`)

// SQLite Store
console.log('\n[2/3] SQLite Store Benchmarks (better-sqlite3)\n')
const { sqliteStore } = await import('../../packages/hitlimit/dist/stores/sqlite.js')

const sqliteMemory = await runBenchmark(
  'SQLite Store - :memory:',
  async () => {
    const store = sqliteStore({ path: ':memory:' })
    return async () => {
      await store.hit('user:123', 60000, 100)
    }
  },
  50_000
)
allResults.push(sqliteMemory)
console.log(`  ${sqliteMemory.name}: ${sqliteMemory.opsPerSecond.toLocaleString()} ops/sec`)

// Redis Store (optional)
console.log('\n[3/3] Redis Store Benchmarks\n')
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

try {
  const { redisStore } = await import('../../packages/hitlimit/dist/stores/redis.js')

  const redisSingle = await runBenchmark(
    'Redis Store - Local',
    async () => {
      const store = redisStore({ url: redisUrl })
      return async () => {
        await store.hit('benchmark:user:123', 60000, 100)
      }
    },
    10_000
  )
  allResults.push(redisSingle)
  console.log(`  ${redisSingle.name}: ${redisSingle.opsPerSecond.toLocaleString()} ops/sec`)
} catch (error) {
  console.log('  Skipped (Redis not available)')
  console.log('  Start Redis: docker run -p 6379:6379 redis:7-alpine')
}

// Final results
formatResults(allResults)

// Save results
saveResults(allResults, 'latest.json')
console.log('Results saved to benchmarks/results/latest.json')
