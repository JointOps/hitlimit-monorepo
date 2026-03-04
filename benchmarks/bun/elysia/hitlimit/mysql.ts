import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { Elysia } from 'elysia'
import { hitlimit } from '../../../../packages/hitlimit-bun/dist/elysia.js'
import { mysqlStore } from '../../../../packages/hitlimit-bun/dist/stores/mysql.js'

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

const store = mysqlStore({ pool, tablePrefix: 'bench_bun_elysia_hl' })

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
  store: 'mysql',
  runtime: 'bun',
  versions: { 'hitlimit-bun': version, elysia: JSON.parse(fs.readFileSync(new URL('../../../node_modules/elysia/package.json', import.meta.url), 'utf-8')).version, mysql2: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mysql2/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => app.handle(new Request('http://localhost/test', { headers: { 'x-forwarded-for': key } })),
  isSync: false,
  cleanup: async () => {
    await pool.execute('DROP TABLE IF EXISTS bench_bun_elysia_hl_hits')
    await pool.execute('DROP TABLE IF EXISTS bench_bun_elysia_hl_bans')
    await pool.execute('DROP TABLE IF EXISTS bench_bun_elysia_hl_violations')
    store.shutdown?.()
    await pool.end()
  }
})
