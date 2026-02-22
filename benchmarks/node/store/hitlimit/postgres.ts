import fs from 'node:fs'
import pg from 'pg'
import { run } from '../../../lib/runner.js'
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

const store = postgresStore({ pool, tablePrefix: 'bench_node_store_hl' })

await run({
  framework: 'store',
  library: 'hitlimit',
  store: 'postgres',
  runtime: 'node',
  versions: { hitlimit: version, pg: JSON.parse(fs.readFileSync(new URL('../../../node_modules/pg/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => store.hit(key, 60000, 1_000_000),
  isSync: false,
  cleanup: async () => {
    await pool.query('DROP TABLE IF EXISTS bench_node_store_hl_hits')
    await pool.end()
  }
})
