import fs from 'node:fs'
import 'reflect-metadata'
import { run } from '../../../lib/runner.js'
import { Test } from '@nestjs/testing'
import { HitLimitModule, HitLimitGuard } from '../../../../packages/hitlimit/dist/nest.js'
import { memoryStore } from '../../../../packages/hitlimit/dist/stores/memory.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()
const store = memoryStore()

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
  store: 'memory',
  runtime: 'node',
  versions: { hitlimit: version, '@nestjs/core': JSON.parse(fs.readFileSync(new URL('../../../node_modules/@nestjs/core/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => guard.canActivate(getCtx(key)),
  isSync: true, // memory store + default key = sync canActivate returns boolean
  cleanup: async () => {
    await moduleRef.close()
    store.shutdown?.()
  }
})
