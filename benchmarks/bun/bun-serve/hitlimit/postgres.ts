import fs from 'node:fs'
import pg from 'pg'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/index.js'
import { postgresStore } from '../../../../packages/hitlimit-bun/dist/stores/postgres.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

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

const store = postgresStore({ pool, tablePrefix: 'bench_bun_serve_hl' })

const handler = (_req: Request) => new Response('ok')
const mw = hitlimit(
  { limit: 1_000_000, window: '1m', store, headers: { standard: false, legacy: false } },
  handler
)

const req = new Request('http://localhost/test')
let currentIp = '127.0.0.1'
const server: any = {
  requestIP: () => ({ address: currentIp })
}

await run({
  framework: 'bun-serve',
  library: 'hitlimit',
  store: 'postgres',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version, pg: JSON.parse(fs.readFileSync(new URL('../../../node_modules/pg/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => {
    currentIp = key
    return mw(req, server)
  },
  isSync: false,
  cleanup: async () => {
    await pool.query('DROP TABLE IF EXISTS bench_bun_serve_hl_hits')
    await pool.end()
  }
})
