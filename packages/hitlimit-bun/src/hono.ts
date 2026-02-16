import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import type { HitLimitOptions, HitLimitInfo, ResponseConfig, ResponseFormatter, StoreResult } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { memoryStore } from './stores/memory.js'

function getDefaultKey(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown'
}

function buildResponseBody(
  response: ResponseConfig | ResponseFormatter,
  info: HitLimitInfo
): Record<string, any> {
  if (typeof response === 'function') {
    return response(info)
  }
  return { ...response, limit: info.limit, remaining: info.remaining, resetIn: info.resetIn }
}

export function hitlimit(options: HitLimitOptions<Context> = {}) {
  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, getDefaultKey)

  const hasSkip = !!config.skip
  const hasTiers = !!(config.tier && config.tiers)
  const hasBan = !!config.ban
  const hasGroup = !!config.group
  const standardHeaders = config.headers.standard
  const legacyHeaders = config.headers.legacy
  const retryAfterHeader = config.headers.retryAfter
  const limit = config.limit
  const windowMs = config.windowMs
  const responseConfig = config.response
  const isSyncStore = store.isSync === true
  const isSyncKey = !options.key

  // Sync fast path: sync store + default key + no skip/tiers/ban/group
  if (!hasSkip && !hasTiers && !hasBan && !hasGroup && isSyncStore && isSyncKey) {
    return createMiddleware(async (c, next) => {
      const key = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
        || c.req.header('x-real-ip')
        || 'unknown'
      const result = store.hit(key, windowMs, limit) as StoreResult
      const allowed = result.count <= limit
      const remaining = Math.max(0, limit - result.count)
      const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

      if (standardHeaders) {
        c.header('RateLimit-Limit', String(limit))
        c.header('RateLimit-Remaining', String(remaining))
        c.header('RateLimit-Reset', String(resetIn))
      }
      if (legacyHeaders) {
        c.header('X-RateLimit-Limit', String(limit))
        c.header('X-RateLimit-Remaining', String(remaining))
        c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
      }

      if (!allowed) {
        if (retryAfterHeader) {
          c.header('Retry-After', String(resetIn))
        }
        const body = buildResponseBody(responseConfig, {
          limit, remaining: 0, resetIn, resetAt: result.resetAt, key
        })
        return c.json(body, 429)
      }

      await next()
    })
  }

  // Full path: async with checkLimit
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
