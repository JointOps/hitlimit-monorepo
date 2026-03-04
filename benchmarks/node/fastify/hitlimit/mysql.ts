import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { hitlimit } from '../../../../packages/hitlimit/dist/index.js'
import { mysqlStore } from '../../../../packages/hitlimit/dist/stores/mysql.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

let pool: any
try {
  const mysql = await import('mysql2/promise')
  pool = mysql.default.createPool({
    host: 'localhost',
    port: 3306,
    user: 'hitlimit',
    password: 'hitlimit',
    database: 'hitlimit_test',
    connectionLimit: 10
  })
  const conn = await pool.getConnection()
  await conn.execute('SELECT 1')
  conn.release()
} catch {
  console.log('MySQL not available, skipping')
  process.exit(0)
}

const prefix = 'bench_node_fastify_hl'
const store = mysqlStore({ pool, tablePrefix: prefix })
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
  store: 'mysql',
  runtime: 'node',
  versions: { hitlimit: version, mysql2: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mysql2/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => mw(getReq(key), res, next),
  isSync: false,
  cleanup: async () => {
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_hits`)
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_bans`)
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_violations`)
    store.shutdown?.()
    await pool.end()
  }
})
