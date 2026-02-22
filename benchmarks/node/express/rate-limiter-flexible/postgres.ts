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
  tableName: 'bench_node_express_rlf',
  tableCreated: false
})

await new Promise(r => setTimeout(r, 1000))

const res: any = {
  statusCode: 200,
  headersSent: false,
  setHeader: () => {},
  getHeader: () => undefined,
  status: function(c: number) { this.statusCode = c; return this },
  json: function() { return this },
  send: function() { return this },
  set: () => {},
  end: () => {}
}
const next = () => {}

await run({
  framework: 'express',
  library: 'rate-limiter-flexible',
  store: 'postgres',
  runtime: 'node',
  versions: { 'rate-limiter-flexible': pkg.version, pg: JSON.parse(fs.readFileSync(new URL('../../../node_modules/pg/package.json', import.meta.url), 'utf-8')).version },
  fn: async (key) => {
    await limiter.consume(key)
    next()
  },
  isSync: false,
  cleanup: async () => {
    await pool.query('DROP TABLE IF EXISTS bench_node_express_rlf')
    await pool.end()
  }
})
