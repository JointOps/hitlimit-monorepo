import type { HitLimitOptions } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { memoryStore } from './stores/memory.js'

export type { HitLimitOptions, HitLimitInfo, HitLimitResult, HitLimitStore, StoreResult, TierConfig, HeadersConfig, ResolvedConfig, KeyGenerator, TierResolver, SkipFunction, StoreErrorHandler, ResponseFormatter, ResponseConfig, BanConfig, GroupIdResolver } from '@joint-ops/hitlimit-types'
export { DEFAULT_LIMIT, DEFAULT_WINDOW, DEFAULT_WINDOW_MS, DEFAULT_MESSAGE } from '@joint-ops/hitlimit-types'
export { memoryStore } from './stores/memory.js'
export { checkLimit }

export interface BunHitLimitOptions extends HitLimitOptions<Request> {
  /**
   * @deprecated Use `store: sqliteStore({ path })` instead.
   *
   * Starting with v1.1.0, the default store is Memory for 15.7x better performance.
   * If you need SQLite persistence:
   *
   * ```typescript
   * import { sqliteStore } from '@joint-ops/hitlimit-bun/stores/sqlite'
   * hitlimit({ store: sqliteStore({ path: './db.sqlite' }) }, handler)
   * ```
   */
  sqlitePath?: string
}

type BunServer = { requestIP(req: Request): { address: string } | null }

type FetchHandler = (req: Request, server: BunServer) => Response | Promise<Response>

function getDefaultKey(req: Request, server: BunServer): string {
  return server.requestIP(req)?.address || 'unknown'
}

export function hitlimit(
  options: BunHitLimitOptions,
  handler: FetchHandler
): (req: Request, server: BunServer) => Response | Promise<Response> {
  // Closure-scoped server reference for default key resolution in checkLimit
  let activeServer: BunServer

  const defaultKey = (req: Request) => {
    return activeServer?.requestIP(req)?.address || 'unknown'
  }

  // Deprecation warning for sqlitePath
  if (options.sqlitePath && !options.store) {
    console.warn(
      '[hitlimit-bun] DEPRECATION WARNING: ' +
      'sqlitePath is deprecated and will be ignored. ' +
      'Use store: sqliteStore({ path }) instead. ' +
      'See migration guide: https://hitlimit.jointops.dev/docs/migration/v1.1.0'
    )
  }

  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, options.key ?? defaultKey)

  // Pre-compute flags
  const hasSkip = !!config.skip
  const hasTiers = !!(config.tier && config.tiers)
  const hasBan = !!config.ban
  const hasGroup = !!config.group
  const standardHeaders = config.headers.standard
  const legacyHeaders = config.headers.legacy
  const retryAfterHeader = config.headers.retryAfter
  const limit = config.limit
  const windowMs = config.windowMs
  const response = config.response
  const customKey = options.key

  // Pre-create blocked response JSON
  const blockedBody = JSON.stringify(response)

  // Fast path: no skip, no tiers, no ban, no group (most common case)
  if (!hasSkip && !hasTiers && !hasBan && !hasGroup) {
    return async (req: Request, server: BunServer) => {
      try {
        const key = customKey ? await customKey(req) : getDefaultKey(req, server)
        const result = await store.hit(key, windowMs, limit)
        const allowed = result.count <= limit

        if (!allowed) {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

          if (standardHeaders) {
            headers['RateLimit-Limit'] = String(limit)
            headers['RateLimit-Remaining'] = '0'
            headers['RateLimit-Reset'] = String(resetIn)
          }
          if (legacyHeaders) {
            headers['X-RateLimit-Limit'] = String(limit)
            headers['X-RateLimit-Remaining'] = '0'
            headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetAt / 1000))
          }
          if (retryAfterHeader) {
            headers['Retry-After'] = String(resetIn)
          }

          return new Response(blockedBody, { status: 429, headers })
        }

        const res = await handler(req, server)

        // Add headers to allowed response
        if (standardHeaders || legacyHeaders) {
          const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)
          const remaining = Math.max(0, limit - result.count)
          const newHeaders = new Headers(res.headers)

          if (standardHeaders) {
            newHeaders.set('RateLimit-Limit', String(limit))
            newHeaders.set('RateLimit-Remaining', String(remaining))
            newHeaders.set('RateLimit-Reset', String(resetIn))
          }
          if (legacyHeaders) {
            newHeaders.set('X-RateLimit-Limit', String(limit))
            newHeaders.set('X-RateLimit-Remaining', String(remaining))
            newHeaders.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
          }

          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: newHeaders
          })
        }

        return res
      } catch (error) {
        const action = await config.onStoreError(error as Error, req)
        if (action === 'deny') {
          return new Response('{"hitlimit":true,"message":"Rate limit error"}', {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        return handler(req, server)
      }
    }
  }

  // Full path: with skip, tiers, ban, or group — delegates to core checkLimit
  return async (req: Request, server: BunServer) => {
    activeServer = server

    if (hasSkip) {
      const shouldSkip = await config.skip!(req)
      if (shouldSkip) {
        return handler(req, server)
      }
    }

    try {
      const result = await checkLimit(config, req)

      if (!result.allowed) {
        return new Response(JSON.stringify(result.body), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...result.headers }
        })
      }

      const res = await handler(req, server)

      // Add rate limit headers to allowed response
      const headerEntries = Object.entries(result.headers)
      if (headerEntries.length > 0) {
        const newHeaders = new Headers(res.headers)
        for (const [key, value] of headerEntries) {
          newHeaders.set(key, value)
        }
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: newHeaders
        })
      }

      return res
    } catch (error) {
      const action = await config.onStoreError(error as Error, req)
      if (action === 'deny') {
        return new Response('{"hitlimit":true,"message":"Rate limit error"}', {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return handler(req, server)
    }
  }
}

export interface HitLimiter {
  check(req: Request, server: BunServer): Response | null | Promise<Response | null>
  reset(key: string): Promise<void> | void
}

export function createHitLimit(options: BunHitLimitOptions = {}): HitLimiter {
  let activeServer: BunServer

  const defaultKey = (req: Request) => {
    return activeServer?.requestIP(req)?.address || 'unknown'
  }

  // Deprecation warning for sqlitePath
  if (options.sqlitePath && !options.store) {
    console.warn(
      '[hitlimit-bun] DEPRECATION WARNING: ' +
      'sqlitePath is deprecated and will be ignored. ' +
      'Use store: sqliteStore({ path }) instead. ' +
      'See migration guide: https://hitlimit.jointops.dev/docs/migration/v1.1.0'
    )
  }

  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, options.key ?? defaultKey)

  return {
    async check(req: Request, server: BunServer): Promise<Response | null> {
      activeServer = server

      if (config.skip) {
        const shouldSkip = await config.skip(req)
        if (shouldSkip) {
          return null
        }
      }

      try {
        const result = await checkLimit(config, req)

        if (!result.allowed) {
          return new Response(JSON.stringify(result.body), {
            status: 429,
            headers: { 'Content-Type': 'application/json', ...result.headers }
          })
        }

        return null
      } catch (error) {
        const action = await config.onStoreError(error as Error, req)
        if (action === 'deny') {
          return new Response('{"hitlimit":true,"message":"Rate limit error"}', {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        return null
      }
    },

    reset(key: string) {
      return store.reset(key)
    }
  }
}
