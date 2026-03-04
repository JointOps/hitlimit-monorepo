import fs from 'node:fs'
import { run } from '../../../lib/runner.js'
import { RateLimiterMySQL } from 'rate-limiter-flexible'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/rate-limiter-flexible/package.json', import.meta.url), 'utf-8'))

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

const limiter = await new Promise<RateLimiterMySQL>((resolve, reject) => {
  const rl = new RateLimiterMySQL({
    storeClient: pool,
    points: 1_000_000,
    duration: 60,
    tableName: 'bench_node_express_rlf',
    clearExpiredByTimeout: false
  }, (err) => {
    if (err) reject(err)
    else resolve(rl)
  })
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

await run({
  framework: 'express',
  library: 'rate-limiter-flexible',
  store: 'mysql',
  runtime: 'node',
  versions: { 'rate-limiter-flexible': pkg.version, mysql2: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mysql2/package.json', import.meta.url), 'utf-8')).version },
  fn: async (key) => {
    await limiter.consume(key)
    next()
  },
  isSync: false,
  cleanup: async () => {
    await pool.execute('DROP TABLE IF EXISTS bench_node_express_rlf')
    await pool.end()
  }
})
