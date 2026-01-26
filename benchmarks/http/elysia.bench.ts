/**
 * Elysia HTTP Throughput Benchmark
 *
 * Measures the overhead of hitlimit-bun/elysia on Elysia applications.
 * Run with: bun benchmarks/http/elysia.bench.ts
 * Then in another terminal: autocannon -c 100 -d 10 http://localhost:3002
 */

import { Elysia } from 'elysia'

const PORT = parseInt(process.env.PORT || '3002')
const WITH_LIMITER = process.env.WITH_LIMITER !== 'false'

async function main() {
  const app = new Elysia()

  if (WITH_LIMITER) {
    const { hitlimit } = await import('hitlimit-bun/elysia')
    const { sqliteStore } = await import('hitlimit-bun/stores/sqlite')

    const store = sqliteStore() // Uses bun:sqlite

    app.use(hitlimit({
      store,
      limit: 1_000_000, // High limit to measure overhead
      window: '1m'
    }))

    console.log('Running WITH rate limiter (bun:sqlite store)')
  } else {
    console.log('Running WITHOUT rate limiter (baseline)')
  }

  app
    .get('/', () => 'OK')
    .listen(PORT)

  console.log(`
Elysia HTTP Benchmark Server
────────────────────────────
Port:        ${PORT}
Rate Limit:  ${WITH_LIMITER ? 'ENABLED' : 'DISABLED'}

Run benchmark with:
  autocannon -c 100 -d 10 http://localhost:${PORT}

To compare:
  # Baseline (no limiter)
  WITH_LIMITER=false bun benchmarks/http/elysia.bench.ts

  # With limiter
  bun benchmarks/http/elysia.bench.ts

Expected results:
  Without limiter: ~130,000 req/sec
  With limiter:    ~115,000 req/sec (11% overhead)
`)
}

main()
