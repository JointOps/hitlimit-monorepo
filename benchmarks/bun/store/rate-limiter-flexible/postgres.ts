import fs from 'node:fs'
import pg from 'pg'
import { run } from '../../../lib/runner.js'
import { RateLimiterPostgres } from 'rate-limiter-flexible'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/rate-limiter-flexible/package.json', import.meta.url), 'utf-8'))

const pool = new pg.Pool({
  connectionString: 'postgres://hitlimit:hitlimit@localhost:5433/hitlimit_test'
})

try {
  const client = await pool.connect()
  await client.query('SELECT 1')
  client.release()
} catch {
  console.log('Postgres not available, skipping')
  process.exit(0)
}

const limiter = new RateLimiterPostgres({
  storeClient: pool,
  points: 1_000_000,
  duration: 60,
  tableName: 'bench_bun_store_rlf',
  tableCreated: false
})

// RateLimiterPostgres creates table on first consume, wait for it
await new Promise(r => setTimeout(r, 1000))

await run({
  framework: 'store',
  library: 'rate-limiter-flexible',
  store: 'postgres',
  runtime: 'bun',
  versions: { 'rate-limiter-flexible': pkg.version, pg: JSON.parse(fs.readFileSync(new URL('../../../node_modules/pg/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => limiter.consume(key),
  isSync: false,
  cleanup: async () => {
    await pool.query('DROP TABLE IF EXISTS bench_bun_store_rlf')
    await pool.end()
  }
})
