import fs from 'node:fs'
import 'reflect-metadata'
import { run } from '../../../lib/runner.js'
import { Test } from '@nestjs/testing'
import { HitLimitModule, HitLimitGuard } from '../../../../packages/hitlimit/dist/nest.js'
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

const prefix = 'bench_node_nestjs_hl'
const store = mysqlStore({ pool, tablePrefix: prefix })

const moduleRef = await Test.createTestingModule({
  imports: [HitLimitModule.register({
    limit: 1_000_000,
    window: '1m',
    store,
    headers: { standard: false, legacy: false }
  })]
}).compile()

const guard = moduleRef.get(HitLimitGuard)

const ctxCache = new Map<string, any>()
function getCtx(ip: string) {
  let ctx = ctxCache.get(ip)
  if (!ctx) {
    const mockReq = {
      ip,
      socket: { remoteAddress: ip },
      headers: {},
      path: '/test',
      method: 'GET',
      url: '/test',
      app: { get: () => undefined }
    }
    ctx = {
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => ({ statusCode: 200, setHeader: () => {}, getHeader: () => undefined })
      }),
      getHandler: () => () => {},
      getClass: () => (class {}),
      getType: () => 'http'
    }
    ctxCache.set(ip, ctx)
  }
  return ctx
}

await run({
  framework: 'nestjs',
  library: 'hitlimit',
  store: 'mysql',
  runtime: 'node',
  versions: { hitlimit: version, '@nestjs/core': JSON.parse(fs.readFileSync(new URL('../../../node_modules/@nestjs/core/package.json', import.meta.url), 'utf-8')).version, mysql2: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mysql2/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => guard.canActivate(getCtx(key)),
  isSync: false,
  cleanup: async () => {
    await moduleRef.close()
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_hits`)
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_bans`)
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_violations`)
    store.shutdown?.()
    await pool.end()
  }
})
