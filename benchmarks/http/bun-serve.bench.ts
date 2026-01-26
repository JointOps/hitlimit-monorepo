/**
 * Bun.serve HTTP Throughput Benchmark
 *
 * Measures the overhead of hitlimit-bun on Bun.serve applications.
 * Run with: bun benchmarks/http/bun-serve.bench.ts
 * Then in another terminal: autocannon -c 100 -d 10 http://localhost:3001
 */

const PORT = parseInt(process.env.PORT || '3001')
const WITH_LIMITER = process.env.WITH_LIMITER !== 'false'

async function main() {
  if (WITH_LIMITER) {
    const { hitlimit } = await import('hitlimit-bun')
    const { sqliteStore } = await import('hitlimit-bun/stores/sqlite')

    const store = sqliteStore() // Uses bun:sqlite

    const server = Bun.serve({
      port: PORT,
      fetch: hitlimit(
        {
          store,
          limit: 1_000_000, // High limit to measure overhead
          window: '1m'
        },
        () => new Response('OK')
      )
    })

    console.log('Running WITH rate limiter (bun:sqlite store)')
  } else {
    const server = Bun.serve({
      port: PORT,
      fetch: () => new Response('OK')
    })

    console.log('Running WITHOUT rate limiter (baseline)')
  }

  console.log(`
Bun.serve HTTP Benchmark Server
───────────────────────────────
Port:        ${PORT}
Rate Limit:  ${WITH_LIMITER ? 'ENABLED' : 'DISABLED'}

Run benchmark with:
  autocannon -c 100 -d 10 http://localhost:${PORT}

To compare:
  # Baseline (no limiter)
  WITH_LIMITER=false bun benchmarks/http/bun-serve.bench.ts

  # With limiter
  bun benchmarks/http/bun-serve.bench.ts

Expected results:
  Without limiter: ~120,000 req/sec
  With limiter:    ~105,000 req/sec (12% overhead)
`)
}

main()
