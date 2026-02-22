import fs from 'node:fs'
import 'reflect-metadata'
import { run } from '../../../lib/runner.js'
import { Test } from '@nestjs/testing'
import { HitLimitModule, HitLimitGuard } from '../../../../packages/hitlimit/dist/nest.js'
import { sqliteStore } from '../../../../packages/hitlimit/dist/stores/sqlite.js'

const version = fs.readFileSync(new URL('../../../../VERSION', import.meta.url), 'utf-8').trim()
const store = sqliteStore({ path: ':memory:' })

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
  store: 'sqlite',
  runtime: 'node',
  versions: { hitlimit: version, '@nestjs/core': JSON.parse(fs.readFileSync(new URL('../../../node_modules/@nestjs/core/package.json', import.meta.url), 'utf-8')).version },
  fn: (key) => guard.canActivate(getCtx(key)),
  isSync: true, // sqlite store + default key = sync canActivate
  cleanup: async () => {
    await moduleRef.close()
    store.shutdown?.()
  }
})
