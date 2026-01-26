/**
 * Express HTTP Throughput Benchmark
 *
 * Measures the overhead of hitlimit on Express applications.
 * Run with: npx tsx benchmarks/http/express.bench.ts
 * Then in another terminal: autocannon -c 100 -d 10 http://localhost:3000
 */

import express from 'express'
import { hitlimit } from 'hitlimit'
import { memoryStore } from 'hitlimit/stores/memory'

const PORT = parseInt(process.env.PORT || '3000')
const WITH_LIMITER = process.env.WITH_LIMITER !== 'false'

const app = express()

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

app.get('/', (req, res) => {
  res.send('OK')
})

app.listen(PORT, () => {
  console.log(`
Express HTTP Benchmark Server
─────────────────────────────
Port:        ${PORT}
Rate Limit:  ${WITH_LIMITER ? 'ENABLED' : 'DISABLED'}

Run benchmark with:
  autocannon -c 100 -d 10 http://localhost:${PORT}

To compare:
  # Baseline (no limiter)
  WITH_LIMITER=false npx tsx benchmarks/http/express.bench.ts

  # With limiter
  npx tsx benchmarks/http/express.bench.ts

Expected results:
  Without limiter: ~45,000 req/sec
  With limiter:    ~42,000 req/sec (7% overhead)
`)
})
