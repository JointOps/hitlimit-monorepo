import { runBenchmark, formatResults, type BenchmarkResult } from '../tools/runner.js'
import { unlinkSync } from 'fs'

// Import from built package
const { sqliteStore } = await import('../../packages/hitlimit/dist/stores/sqlite.js')

async function main() {
  console.log('SQLite Store Benchmarks (Node.js - better-sqlite3)')
  console.log('==================================================\n')

  const results: BenchmarkResult[] = []

  // In-memory SQLite
  const memoryResult = await runBenchmark(
    'SQLite Store - :memory:',
    async () => {
      const store = sqliteStore({ path: ':memory:' })
      return async () => {
        await store.hit('user:123', 60000, 100)
      }
    },
    50_000
  )
  results.push(memoryResult)

  // File-based SQLite
  const dbPath = './benchmark-test.db'
  try { unlinkSync(dbPath) } catch {}
  try { unlinkSync(dbPath + '-wal') } catch {}
  try { unlinkSync(dbPath + '-shm') } catch {}

  const fileResult = await runBenchmark(
    'SQLite Store - File',
    async () => {
      const store = sqliteStore({ path: dbPath })
      return async () => {
        await store.hit('user:123', 60000, 100)
      }
    },
    50_000
  )
  results.push(fileResult)

  // Cleanup
  try { unlinkSync(dbPath) } catch {}
  try { unlinkSync(dbPath + '-wal') } catch {}
  try { unlinkSync(dbPath + '-shm') } catch {}

  // Multiple keys
  const multiKeyResult = await runBenchmark(
    'SQLite Store - 10,000 Keys (:memory:)',
    async () => {
      const store = sqliteStore({ path: ':memory:' })
      let keyIndex = 0
      return async () => {
        await store.hit(`user:${keyIndex++ % 10000}`, 60000, 100)
      }
    },
    50_000
  )
  results.push(multiKeyResult)

  formatResults(results)
  return results
}

main().catch(console.error)

export { main as runSqliteBenchmarks }
