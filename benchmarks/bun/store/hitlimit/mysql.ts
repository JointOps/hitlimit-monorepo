import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
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

const prefix = 'bench_bun_store_hl'
const store = mysqlStore({ pool, tablePrefix: prefix })

await run({
  framework: 'store',
  library: 'hitlimit',
  store: 'mysql',
  runtime: 'bun',
  versions: {
    'hitlimit-bun': version,
    mysql2: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mysql2/package.json', import.meta.url), 'utf-8')).version
  },
  fn: (key) => store.hit(key, 60000, 1_000_000),
  isSync: false,
  cleanup: async () => {
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_hits`)
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_bans`)
    await pool.execute(`DROP TABLE IF EXISTS ${prefix}_violations`)
    store.shutdown?.()
    await pool.end()
  }
})
