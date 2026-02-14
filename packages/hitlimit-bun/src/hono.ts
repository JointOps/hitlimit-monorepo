import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import type { HitLimitOptions } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { memoryStore } from './stores/memory.js'

function getDefaultKey(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown'
}

export function hitlimit(options: HitLimitOptions<Context> = {}) {
  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, getDefaultKey)

  return createMiddleware(async (c, next) => {
    if (config.skip) {
      const shouldSkip = await config.skip(c)
      if (shouldSkip) {
        await next()
        return
      }
    }

    try {
      const result = await checkLimit(config, c)

      for (const [key, value] of Object.entries(result.headers)) {
        c.header(key, value)
      }

      if (!result.allowed) {
        return c.json(result.body, 429)
      }
    } catch (error) {
      const action = await config.onStoreError(error as Error, c)
      if (action === 'deny') {
        return c.json({ hitlimit: true, message: 'Rate limit error' }, 429)
      }
    }

    await next()
  })
}
