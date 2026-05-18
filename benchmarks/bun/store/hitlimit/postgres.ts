import fs from 'node:fs'
import { SQL } from 'bun'
import { run } from '../../../lib/runner.js'
import { postgresStore } from '../../../../packages/hitlimit-bun/dist/stores/postgres.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

const client = new SQL('postgres://hitlimit:hitlimit@localhost:5433/hitlimit_test')

try {
  await client`SELECT 1`
} catch {
  console.log('Postgres not available, skipping')
  process.exit(0)
}

const store = postgresStore({ client, tablePrefix: 'bench_bun_store_hl' })

await run({
  framework: 'store',
  library: 'hitlimit',
  store: 'postgres',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version },
  fn: (key) => store.hit(key, 60000, 1_000_000),
  isSync: false,
  cleanup: async () => {
    await client.unsafe('DROP TABLE IF EXISTS bench_bun_store_hl_hits')
    await client.unsafe('DROP TABLE IF EXISTS bench_bun_store_hl_bans')
    await client.unsafe('DROP TABLE IF EXISTS bench_bun_store_hl_violations')
    await client.close()
  }
})
