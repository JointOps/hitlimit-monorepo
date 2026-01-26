// This benchmark must be run with Bun
// Usage: bun run stores/bun-sqlite.bench.ts

import { sqliteStore } from '../../packages/hitlimit-bun/dist/stores/sqlite.js'
import { memoryStore } from '../../packages/hitlimit-bun/dist/stores/memory.js'

interface BenchmarkResult {
  name: string
  opsPerSecond: number
  avgLatencyMs: number
}

function runBenchmark(
  name: string,
  fn: () => void,
  iterations: number = 100_000
): BenchmarkResult {
  // Warmup
  for (let i = 0; i < 1000; i++) {
    fn()
  }

  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const duration = performance.now() - start

  return {
    name,
    opsPerSecond: Math.round(iterations / (duration / 1000)),
    avgLatencyMs: Number((duration / iterations).toFixed(4))
  }
}

console.log('Bun Store Benchmarks')
console.log('====================')
console.log(`Bun version: ${Bun.version}\n`)

// bun:sqlite benchmark - single key
const sqliteStoreInstance = sqliteStore()
const sqliteSingle = runBenchmark(
  'bun:sqlite Store - Single Key',
  () => {
    sqliteStoreInstance.hit('user:123', 60000, 100)
  }
)
console.log(`${sqliteSingle.name}`)
console.log(`  Throughput: ${sqliteSingle.opsPerSecond.toLocaleString()} ops/sec`)
console.log(`  Avg Latency: ${sqliteSingle.avgLatencyMs}ms\n`)

// bun:sqlite benchmark - multiple keys
const sqliteMultiStore = sqliteStore()
let keyIndex = 0
const sqliteMulti = runBenchmark(
  'bun:sqlite Store - 10,000 Keys',
  () => {
    sqliteMultiStore.hit(`user:${keyIndex++ % 10000}`, 60000, 100)
  }
)
console.log(`${sqliteMulti.name}`)
console.log(`  Throughput: ${sqliteMulti.opsPerSecond.toLocaleString()} ops/sec`)
console.log(`  Avg Latency: ${sqliteMulti.avgLatencyMs}ms\n`)

// Memory store benchmark
const memStore = memoryStore()
const memorySingle = runBenchmark(
  'Memory Store (Bun) - Single Key',
  () => {
    memStore.hit('user:123', 60000, 100)
  }
)
console.log(`${memorySingle.name}`)
console.log(`  Throughput: ${memorySingle.opsPerSecond.toLocaleString()} ops/sec`)
console.log(`  Avg Latency: ${memorySingle.avgLatencyMs}ms\n`)

// Memory store - multiple keys
const memMultiStore = memoryStore()
let memKeyIndex = 0
const memoryMulti = runBenchmark(
  'Memory Store (Bun) - 10,000 Keys',
  () => {
    memMultiStore.hit(`user:${memKeyIndex++ % 10000}`, 60000, 100)
  }
)
console.log(`${memoryMulti.name}`)
console.log(`  Throughput: ${memoryMulti.opsPerSecond.toLocaleString()} ops/sec`)
console.log(`  Avg Latency: ${memoryMulti.avgLatencyMs}ms\n`)

console.log('='.repeat(50))
console.log('Summary:')
console.log(`  bun:sqlite: ${sqliteSingle.opsPerSecond.toLocaleString()} ops/sec`)
console.log(`  Memory:     ${memorySingle.opsPerSecond.toLocaleString()} ops/sec`)
