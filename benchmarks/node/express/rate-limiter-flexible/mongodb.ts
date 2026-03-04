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
  tableName: 'bench_node_express_rlf'
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
  store: 'mongodb',
  runtime: 'node',
  versions: { 'rate-limiter-flexible': pkg.version, mongodb: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mongodb/package.json', import.meta.url), 'utf-8')).version },
  fn: async (key) => {
    await limiter.consume(key)
    next()
  },
  isSync: false,
  cleanup: async () => {
    await db.collection('bench_node_express_rlf').drop().catch(() => {})
    await client.close()
  }
})
