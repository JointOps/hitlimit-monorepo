/**
 * Hono (Bun) HTTP Throughput Benchmark
 *
 * Measures the overhead of hitlimit on Hono applications running on Bun.
 * Run with: bun benchmarks/http/hono-bun.bench.ts
 * Then in another terminal: autocannon -c 100 -d 10 http://localhost:3005
 */

import { Hono } from 'hono'
import { hitlimit } from '@joint-ops/hitlimit-bun/hono'
import { memoryStore } from '@joint-ops/hitlimit-bun/stores/memory'

const PORT = parseInt(process.env.PORT || '3005')
const WITH_LIMITER = process.env.WITH_LIMITER !== 'false'

const app = new Hono()

if (WITH_LIMITER) {
  const store = memoryStore()
  app.use(hitlimit({
    store,
    limit: 1_000_000, // High limit to measure overhead, not blocking
    window: '1m'
  }))
  console.log('Running WITH rate limiter')
} else {
  console.log('Running WITHOUT rate limiter (baseline)')
}

app.get('/', (c) => c.text('OK'))

Bun.serve({
  port: PORT,
  fetch: app.fetch
})

console.log(`
Hono (Bun) HTTP Benchmark Server
─────────────────────────────────
Port:        ${PORT}
Rate Limit:  ${WITH_LIMITER ? 'ENABLED' : 'DISABLED'}

Run benchmark with:
  autocannon -c 100 -d 10 http://localhost:${PORT}

To compare:
  # Baseline (no limiter)
  WITH_LIMITER=false bun benchmarks/http/hono-bun.bench.ts

  # With limiter
  bun benchmarks/http/hono-bun.bench.ts

Expected results:
  Without limiter: ~120,000 req/sec
  With limiter:    ~105,000 req/sec (12% overhead)
`)
