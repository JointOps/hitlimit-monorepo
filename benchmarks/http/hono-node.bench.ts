/**
 * Hono (Node.js) HTTP Throughput Benchmark
 *
 * Measures the overhead of hitlimit on Hono applications running on Node.js.
 * Run with: npx tsx benchmarks/http/hono-node.bench.ts
 * Then in another terminal: autocannon -c 100 -d 10 http://localhost:3004
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { hitlimit } from 'hitlimit/hono'
import { memoryStore } from 'hitlimit/stores/memory'

const PORT = parseInt(process.env.PORT || '3004')
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

serve({ fetch: app.fetch, port: PORT })

console.log(`
Hono (Node.js) HTTP Benchmark Server
─────────────────────────────────────
Port:        ${PORT}
Rate Limit:  ${WITH_LIMITER ? 'ENABLED' : 'DISABLED'}

Run benchmark with:
  autocannon -c 100 -d 10 http://localhost:${PORT}

To compare:
  # Baseline (no limiter)
  WITH_LIMITER=false npx tsx benchmarks/http/hono-node.bench.ts

  # With limiter
  npx tsx benchmarks/http/hono-node.bench.ts

Expected results:
  Without limiter: ~50,000 req/sec
  With limiter:    ~46,000 req/sec (8% overhead)
`)
