import fs from 'node:fs'
import { SQL } from 'bun'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/index.js'
import { postgresStore } from '../../../../packages/hitlimit-bun/dist/stores/postgres.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

const client = new SQL('postgres://hitlimit:hitlimit@localhost:5433/hitlimit_test')

try {
  await client`SELECT 1`
} catch {
  console.log('Postgres not available, skipping')
  process.exit(0)
}

const store = postgresStore({ client, tablePrefix: 'bench_bun_serve_hl' })

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
  versions: { 'hitlimit-bun': version },
  fn: (key) => {
    currentIp = key
    return mw(req, server)
  },
  isSync: false,
  cleanup: async () => {
    await client.unsafe('DROP TABLE IF EXISTS bench_bun_serve_hl_hits')
    await client.unsafe('DROP TABLE IF EXISTS bench_bun_serve_hl_bans')
    await client.unsafe('DROP TABLE IF EXISTS bench_bun_serve_hl_violations')
    await client.close()
  }
})
