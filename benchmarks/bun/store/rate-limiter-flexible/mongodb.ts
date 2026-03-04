import fs from 'node:fs'
import { MongoClient } from 'mongodb'
import { run } from '../../../lib/runner.js'
import { RateLimiterMongo } from 'rate-limiter-flexible'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/rate-limiter-flexible/package.json', import.meta.url), 'utf-8'))

let client: MongoClient
try {
  client = new MongoClient('mongodb://localhost:27017')
  await client.connect()
  await client.db('admin').command({ ping: 1 })
} catch {
  console.log('MongoDB not available, skipping')
  process.exit(0)
}

const db = client.db('hitlimit_bench')

const limiter = new RateLimiterMongo({
  storeClient: db,
  points: 1_000_000,
  duration: 60,
  tableName: 'bench_bun_store_rlf'
})

await run({
  framework: 'store',
  library: 'rate-limiter-flexible',
  store: 'mongodb',
  runtime: 'bun',
  versions: { 'rate-limiter-flexible': pkg.version, mongodb: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mongodb/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => limiter.consume(key),
  isSync: false,
  cleanup: async () => {
    await db.collection('bench_bun_store_rlf').drop().catch(() => {})
    await client.close()
  }
})
