import fs from 'node:fs'
import pg from 'pg'
import { run } from '../../../lib/runner.js'
import Fastify from 'fastify'
import { hitlimit } from '../../../../packages/hitlimit/dist/fastify.js'
import { postgresStore } from '../../../../packages/hitlimit/dist/stores/postgres.js'

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

const store = postgresStore({ pool, tablePrefix: 'bench_node_fastify_hl' })
const app = Fastify()

await app.register(hitlimit, {
  limit: 1_000_000,
  window: '1m',
  store,
  headers: { standard: false, legacy: false }
})

app.get('/test', () => 'ok')
await app.ready()

await run({
  framework: 'fastify',
  library: 'hitlimit',
  store: 'postgres',
  runtime: 'node',
  versions: { hitlimit: version, fastify: JSON.parse(fs.readFileSync(new URL('../../../node_modules/fastify/package.json', import.meta.url), 'utf-8')).version, pg: JSON.parse(fs.readFileSync(new URL('../../../node_modules/pg/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.inject({ method: 'GET', url: '/test', remoteAddress: key }),
  isSync: false,
  cleanup: async () => {
    await app.close()
    await pool.query('DROP TABLE IF EXISTS bench_node_fastify_hl_hits')
    await pool.end()
  }
})
