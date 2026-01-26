import { runBenchmark, formatResults, type BenchmarkResult } from '../tools/runner.js'

// Import from built package
const { memoryStore } = await import('../../packages/hitlimit/dist/stores/memory.js')

async function main() {
  console.log('Memory Store Benchmarks')
  console.log('=======================\n')

  const results: BenchmarkResult[] = []

  // Single key benchmark
  const singleKey = await runBenchmark(
    'Memory Store - Single Key',
    async () => {
      const store = memoryStore()
      return async () => {
        await store.hit('user:123', 60000, 100)
      }
    }
  )
  results.push(singleKey)

  // Multiple keys benchmark
  const multiKey = await runBenchmark(
    'Memory Store - 10,000 Keys',
    async () => {
      const store = memoryStore()
      let keyIndex = 0
      return async () => {
        await store.hit(`user:${keyIndex++ % 10000}`, 60000, 100)
      }
    }
  )
  results.push(multiKey)

  // High concurrency simulation
  const highLoad = await runBenchmark(
    'Memory Store - High Load (100k keys)',
    async () => {
      const store = memoryStore()
      let keyIndex = 0
      return async () => {
        await store.hit(`user:${keyIndex++ % 100000}`, 60000, 100)
      }
    },
    50_000
  )
  results.push(highLoad)

  formatResults(results)
  return results
}

main().catch(console.error)

export { main as runMemoryBenchmarks }
