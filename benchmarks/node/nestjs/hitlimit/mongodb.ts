import fs from 'node:fs'
import { MongoClient } from 'mongodb'
import 'reflect-metadata'
import { run } from '../../../lib/runner.js'
import { Test } from '@nestjs/testing'
import { HitLimitModule, HitLimitGuard } from '../../../../packages/hitlimit/dist/nest.js'
import { mongoStore } from '../../../../packages/hitlimit/dist/stores/mongodb.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

let client: MongoClient
let db: any
try {
  client = new MongoClient('mongodb://localhost:27017')
  await client.connect()
  await client.db('admin').command({ ping: 1 })
  db = client.db('hitlimit_bench')
} catch {
  console.log('MongoDB not available, skipping')
  process.exit(0)
}

const store = mongoStore({ db, collectionPrefix: 'bench_node_nestjs_hl' })

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
  store: 'mongodb',
  runtime: 'node',
  versions: { hitlimit: version, '@nestjs/core': JSON.parse(fs.readFileSync(new URL('../../../node_modules/@nestjs/core/package.json', import.meta.url), 'utf-8')).version, mongodb: JSON.parse(fs.readFileSync(new URL('../../../node_modules/mongodb/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => guard.canActivate(getCtx(key)),
  isSync: false,
  cleanup: async () => {
    await moduleRef.close()
    await db.collection('bench_node_nestjs_hl_hits').drop().catch(() => {})
    await db.collection('bench_node_nestjs_hl_bans').drop().catch(() => {})
    await db.collection('bench_node_nestjs_hl_violations').drop().catch(() => {})
    store.shutdown?.()
    await client.close()
  }
})
