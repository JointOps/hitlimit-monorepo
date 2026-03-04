import fs from 'node:fs'
import pg from 'pg'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit/dist/index.js'
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
const mw = hitlimit({
  limit: 1_000_000,
  window: '1m',
  store,
  headers: { standard: false, legacy: false }
})

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

const reqCache = new Map<string, any>()
function getReq(ip: string) {
  let r = reqCache.get(ip)
  if (!r) {
    r = {
      ip,
      socket: { remoteAddress: ip },
      headers: {},
      path: '/api/test',
      method: 'GET',
      url: '/api/test',
      app: { get: (s: string) => s === 'trust proxy' ? false : undefined }
    }
    reqCache.set(ip, r)
  }
  return r
}

await run({
  framework: 'fastify',
  library: 'hitlimit',
  store: 'postgres',
  runtime: 'node',
  versions: { hitlimit: version, pg: JSON.parse(fs.readFileSync(new URL('../../../node_modules/pg/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => mw(getReq(key), res, next),
  isSync: false,
  cleanup: async () => {
    await pool.query('DROP TABLE IF EXISTS bench_node_fastify_hl_hits')
    await pool.end()
  }
})
