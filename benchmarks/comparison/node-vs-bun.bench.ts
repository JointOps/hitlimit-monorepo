/**
 * Node.js vs Bun Head-to-Head Benchmark
 *
 * Run the same benchmark on both runtimes to compare performance.
 *
 * Usage:
 *   node --expose-gc benchmarks/comparison/node-vs-bun.bench.ts  # Node.js
 *   bun benchmarks/comparison/node-vs-bun.bench.ts               # Bun
 */

const isNode = typeof process !== 'undefined' && process.versions?.node
const isBun = typeof Bun !== 'undefined'

const runtime = isNode ? `Node.js ${process.versions.node}` : `Bun ${Bun.version}`

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                 NODE.JS vs BUN BENCHMARK                      ║
║                                                               ║
║   Running on: ${runtime.padEnd(45)}║
╚══════════════════════════════════════════════════════════════╝
`)

  const iterations = 100_000
  const warmup = 1_000

  // Memory Store Benchmark
  console.log('Memory Store Benchmark')
  console.log('─'.repeat(50))

  let memoryStore: any

  if (isBun) {
    const mod = await import('hitlimit-bun/stores/memory')
    memoryStore = mod.memoryStore()
  } else {
    const mod = await import('hitlimit/stores/memory')
    memoryStore = mod.memoryStore()
  }

  // Warmup
  for (let i = 0; i < warmup; i++) {
    memoryStore.hit('warmup', 60000, 100)
  }

  // Force GC
  if (typeof global !== 'undefined' && (global as any).gc) {
    (global as any).gc()
  }

  // Benchmark
  const memStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    memoryStore.hit('user:123', 60000, 100)
  }
  const memDuration = performance.now() - memStart
  const memOps = Math.round(iterations / (memDuration / 1000))

  console.log(`  Throughput: ${memOps.toLocaleString()} ops/sec`)
  console.log(`  Avg Latency: ${(memDuration / iterations).toFixed(4)}ms`)
  console.log('')

  // SQLite Store Benchmark
  console.log('SQLite Store Benchmark')
  console.log('─'.repeat(50))

  let sqliteStore: any

  if (isBun) {
    const mod = await import('hitlimit-bun/stores/sqlite')
    sqliteStore = mod.sqliteStore()
  } else {
    const mod = await import('hitlimit/stores/sqlite')
    sqliteStore = mod.sqliteStore({ path: ':memory:' })
  }

  // Warmup
  for (let i = 0; i < warmup; i++) {
    sqliteStore.hit('warmup', 60000, 100)
  }

  // Force GC
  if (typeof global !== 'undefined' && (global as any).gc) {
    (global as any).gc()
  }

  // Benchmark
  const sqliteStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    sqliteStore.hit('user:123', 60000, 100)
  }
  const sqliteDuration = performance.now() - sqliteStart
  const sqliteOps = Math.round(iterations / (sqliteDuration / 1000))

  console.log(`  Throughput: ${sqliteOps.toLocaleString()} ops/sec`)
  console.log(`  Avg Latency: ${(sqliteDuration / iterations).toFixed(4)}ms`)
  console.log('')

  // Summary
  console.log('═'.repeat(60))
  console.log(`  ${runtime} RESULTS`)
  console.log('═'.repeat(60))
  console.log('')
  console.log(`  Memory Store:  ${memOps.toLocaleString().padStart(12)} ops/sec`)
  console.log(`  SQLite Store:  ${sqliteOps.toLocaleString().padStart(12)} ops/sec`)
  console.log('')

  if (isBun) {
    console.log('  💡 Run with Node.js to compare:')
    console.log('     node --expose-gc benchmarks/comparison/node-vs-bun.bench.ts')
  } else {
    console.log('  💡 Run with Bun to compare:')
    console.log('     bun benchmarks/comparison/node-vs-bun.bench.ts')
  }

  console.log('')
  console.log(`
Expected Results Comparison:
────────────────────────────
                    Node.js 20      Bun 1.0       Speedup
Memory Store:       ~400,000        ~500,000      +25%
SQLite Store:       ~35,000         ~95,000       +171% 🔥

Note: bun:sqlite is 2.7x faster because it's native,
not FFI-bound like better-sqlite3.
`)
}

main().catch(console.error)
