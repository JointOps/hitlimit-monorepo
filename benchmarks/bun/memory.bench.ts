/**
 * Bun Memory Store Benchmark
 *
 * Benchmark hitlimit-bun's memory store using Bun's native performance APIs.
 * Run with: bun benchmarks/bun/memory.bench.ts
 */

import { memoryStore } from 'hitlimit-bun/stores/memory'

const store = memoryStore()
const iterations = 100_000
const warmup = 1_000

// Warmup
for (let i = 0; i < warmup; i++) {
  store.hit('warmup', 60000, 100)
}

// Force GC
Bun.gc(true)

console.log(`
Bun Memory Store Benchmark
══════════════════════════
`)

// Single key benchmark
const singleStart = Bun.nanoseconds()
for (let i = 0; i < iterations; i++) {
  store.hit('user:123', 60000, 100)
}
const singleDuration = (Bun.nanoseconds() - singleStart) / 1_000_000 // Convert to ms
const singleOps = Math.round(iterations / (singleDuration / 1000))

console.log(`Single Key:`)
console.log(`  Operations:  ${iterations.toLocaleString()}`)
console.log(`  Duration:    ${(singleDuration / 1000).toFixed(3)} seconds`)
console.log(`  Throughput:  ${singleOps.toLocaleString()} ops/sec`)
console.log(`  Avg Latency: ${(singleDuration / iterations).toFixed(4)}ms`)
console.log('')

// Multiple keys benchmark
const multiStore = memoryStore()
const multiStart = Bun.nanoseconds()
for (let i = 0; i < iterations; i++) {
  multiStore.hit(`user:${i % 10000}`, 60000, 100)
}
const multiDuration = (Bun.nanoseconds() - multiStart) / 1_000_000
const multiOps = Math.round(iterations / (multiDuration / 1000))

console.log(`10,000 Unique Keys:`)
console.log(`  Operations:  ${iterations.toLocaleString()}`)
console.log(`  Duration:    ${(multiDuration / 1000).toFixed(3)} seconds`)
console.log(`  Throughput:  ${multiOps.toLocaleString()} ops/sec`)
console.log(`  Avg Latency: ${(multiDuration / iterations).toFixed(4)}ms`)
console.log('')

// Memory usage
const mem = process.memoryUsage()
console.log(`Memory Usage:`)
console.log(`  Heap Used:   ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`)
console.log(`  Heap Total:  ${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`)
console.log('')

console.log(`Expected: ~500,000 ops/sec (single key)`)
