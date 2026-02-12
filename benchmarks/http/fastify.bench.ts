/**
 * Fastify HTTP Throughput Benchmark
 *
 * Measures the overhead of hitlimit on Fastify applications.
 * Run with: npx tsx benchmarks/http/fastify.bench.ts
 * Then in another terminal: autocannon -c 100 -d 10 http://localhost:3003
 */

import Fastify from 'fastify'
import { hitlimit } from 'hitlimit/fastify'
import { memoryStore } from 'hitlimit/stores/memory'

const PORT = parseInt(process.env.PORT || '3003')
const WITH_LIMITER = process.env.WITH_LIMITER !== 'false'

const app = Fastify()

if (WITH_LIMITER) {
  const store = memoryStore()
  await app.register(hitlimit, {
    store,
    limit: 1_000_000, // High limit to measure overhead, not blocking
    window: '1m'
  })
  console.log('Running WITH rate limiter')
} else {
  console.log('Running WITHOUT rate limiter (baseline)')
}

app.get('/', () => 'OK')

await app.listen({ port: PORT })

console.log(`
Fastify HTTP Benchmark Server
──────────────────────────────
Port:        ${PORT}
Rate Limit:  ${WITH_LIMITER ? 'ENABLED' : 'DISABLED'}

Run benchmark with:
  autocannon -c 100 -d 10 http://localhost:${PORT}

To compare:
  # Baseline (no limiter)
  WITH_LIMITER=false npx tsx benchmarks/http/fastify.bench.ts

  # With limiter
  npx tsx benchmarks/http/fastify.bench.ts

Expected results:
  Without limiter: ~55,000 req/sec
  With limiter:    ~51,000 req/sec (6-8% overhead)
`)
