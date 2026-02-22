import fs from 'node:fs'
import Redis from 'ioredis'
import 'reflect-metadata'
import { run } from '../../../lib/runner.js'
import { Test } from '@nestjs/testing'
import { HitLimitModule, HitLimitGuard } from '../../../../packages/hitlimit/dist/nest.js'
import { redisStore } from '../../../../packages/hitlimit/dist/stores/redis.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()

const redis = new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: 1, lazyConnect: true })
try {
  await redis.connect()
  await redis.ping()
} catch {
  console.log('Redis not available, skipping')
  process.exit(0)
}
await redis.quit()

const store = redisStore({ url: 'redis://localhost:6379', keyPrefix: 'bench:node-nestjs-hl:' })

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
  store: 'redis',
  runtime: 'node',
  versions: { hitlimit: version, '@nestjs/core': JSON.parse(fs.readFileSync(new URL('../../../node_modules/@nestjs/core/package.json', import.meta.url), 'utf-8')).version, ioredis: JSON.parse(fs.readFileSync(new URL('../../../node_modules/ioredis/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => guard.canActivate(getCtx(key)),
  isSync: false,
  cleanup: async () => {
    await moduleRef.close()
    const c = new Redis({ host: 'localhost', port: 6379 })
    const keys = await c.keys('bench:node-nestjs-hl:*')
    if (keys.length) await c.del(...keys)
    await c.quit()
    await store.shutdown?.()
  }
})
