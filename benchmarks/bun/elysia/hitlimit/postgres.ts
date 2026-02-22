import fs from 'node:fs'
import pg from 'pg'
import { run } from '../../../lib/runner.js'
import { Elysia } from 'elysia'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/elysia.js'
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

const store = postgresStore({ pool, tablePrefix: 'bench_bun_elysia_hl' })

const app = new Elysia()
  .use(hitlimit({
    limit: 1_000_000,
    window: '1m',
    store,
    headers: { standard: false, legacy: false }
  }))
  .get('/test', () => 'ok')

await run({
  framework: 'elysia',
  library: 'hitlimit',
  store: 'postgres',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version, elysia: JSON.parse(fs.readFileSync(new URL('../../../node_modules/elysia/package.json', import.meta.url), 'utf-8')).version, pg: JSON.parse(fs.readFileSync(new URL('../../../node_modules/pg/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.handle(new Request('http://localhost/test', { headers: { 'x-forwarded-for': key } })),
  isSync: false,
  cleanup: async () => {
    await pool.query('DROP TABLE IF EXISTS bench_bun_elysia_hl_hits')
    await pool.end()
  }
})
