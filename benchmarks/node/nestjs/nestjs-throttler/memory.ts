import fs from 'node:fs'
import 'reflect-metadata'
import { run } from '../../../lib/runner.js'
import { Test } from '@nestjs/testing'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'

const pkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/@nestjs/throttler/package.json', import.meta.url), 'utf-8'))
const nestPkg = JSON.parse(fs.readFileSync(new URL('../../../node_modules/@nestjs/core/package.json', import.meta.url), 'utf-8'))

const moduleRef = await Test.createTestingModule({
  imports: [ThrottlerModule.forRoot([{
    ttl: 60000,
    limit: 1_000_000
  }])]
}).compile()

const guard = moduleRef.get(ThrottlerGuard)

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
        getResponse: () => ({ statusCode: 200, setHeader: () => {}, getHeader: () => undefined, header: () => {} })
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
  library: 'nestjs-throttler',
  store: 'memory',
  runtime: 'node',
  versions: { '@nestjs/throttler': pkg.version, '@nestjs/core': nestPkg.version },
  fn: (key) => guard.canActivate(getCtx(key)),
  isSync: false, // ThrottlerGuard.canActivate returns Promise
  cleanup: () => moduleRef.close()
})
