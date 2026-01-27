import type { HitLimitOptions } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { sqliteStore } from './stores/sqlite.js'

export type { HitLimitOptions, HitLimitInfo, HitLimitResult, HitLimitStore, StoreResult, TierConfig, HeadersConfig, ResolvedConfig, KeyGenerator, TierResolver, SkipFunction, StoreErrorHandler, ResponseFormatter, ResponseConfig } from '@joint-ops/hitlimit-types'
export { DEFAULT_LIMIT, DEFAULT_WINDOW, DEFAULT_WINDOW_MS, DEFAULT_MESSAGE } from '@joint-ops/hitlimit-types'
export { sqliteStore } from './stores/sqlite.js'
export { checkLimit } from './core/limiter.js'

export interface BunHitLimitOptions extends HitLimitOptions<Request> {
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
  const store = options.store ?? sqliteStore({ path: options.sqlitePath })
  const config = resolveConfig(options, store, () => 'unknown')

  // Pre-compute flags
  const hasSkip = !!config.skip
  const hasTiers = !!(config.tier && config.tiers)
  const standardHeaders = config.headers.standard
  const legacyHeaders = config.headers.legacy
  const retryAfterHeader = config.headers.retryAfter
  const limit = config.limit
  const windowMs = config.windowMs
  const response = config.response
  const customKey = options.key

  // Pre-create blocked response JSON
  const blockedBody = JSON.stringify(response)

  // Fast path: no skip, no tiers
  if (!hasSkip && !hasTiers) {
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

  // Full path: with skip and/or tiers
  return async (req: Request, server: BunServer) => {
    if (hasSkip) {
      const shouldSkip = await config.skip!(req)
      if (shouldSkip) {
        return handler(req, server)
      }
    }

    try {
      const key = customKey ? await customKey(req) : getDefaultKey(req, server)

      let effectiveLimit = limit
      let effectiveWindowMs = windowMs

      if (hasTiers) {
        const tierName = await config.tier!(req)
        const tierConfig = config.tiers![tierName]
        if (tierConfig) {
          effectiveLimit = tierConfig.limit
          if (tierConfig.window) {
            effectiveWindowMs = parseWindow(tierConfig.window)
          }
        }
      }

      if (effectiveLimit === Infinity) {
        return handler(req, server)
      }

      const result = await store.hit(key, effectiveWindowMs, effectiveLimit)
      const allowed = result.count <= effectiveLimit

      if (!allowed) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

        if (standardHeaders) {
          headers['RateLimit-Limit'] = String(effectiveLimit)
          headers['RateLimit-Remaining'] = '0'
          headers['RateLimit-Reset'] = String(resetIn)
        }
        if (legacyHeaders) {
          headers['X-RateLimit-Limit'] = String(effectiveLimit)
          headers['X-RateLimit-Remaining'] = '0'
          headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetAt / 1000))
        }
        if (retryAfterHeader) {
          headers['Retry-After'] = String(resetIn)
        }

        return new Response(blockedBody, { status: 429, headers })
      }

      const res = await handler(req, server)

      if (standardHeaders || legacyHeaders) {
        const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)
        const remaining = Math.max(0, effectiveLimit - result.count)
        const newHeaders = new Headers(res.headers)

        if (standardHeaders) {
          newHeaders.set('RateLimit-Limit', String(effectiveLimit))
          newHeaders.set('RateLimit-Remaining', String(remaining))
          newHeaders.set('RateLimit-Reset', String(resetIn))
        }
        if (legacyHeaders) {
          newHeaders.set('X-RateLimit-Limit', String(effectiveLimit))
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

export interface HitLimiter {
  check(req: Request, server: BunServer): Response | null | Promise<Response | null>
  reset(key: string): Promise<void> | void
}

export function createHitLimit(options: BunHitLimitOptions = {}): HitLimiter {
  const store = options.store ?? sqliteStore({ path: options.sqlitePath })
  const config = resolveConfig(options, store, () => 'unknown')

  const hasSkip = !!config.skip
  const hasTiers = !!(config.tier && config.tiers)
  const standardHeaders = config.headers.standard
  const legacyHeaders = config.headers.legacy
  const retryAfterHeader = config.headers.retryAfter
  const limit = config.limit
  const windowMs = config.windowMs
  const response = config.response
  const customKey = options.key
  const blockedBody = JSON.stringify(response)

  return {
    async check(req: Request, server: BunServer): Promise<Response | null> {
      if (hasSkip) {
        const shouldSkip = await config.skip!(req)
        if (shouldSkip) {
          return null
        }
      }

      try {
        const key = customKey ? await customKey(req) : getDefaultKey(req, server)

        let effectiveLimit = limit
        let effectiveWindowMs = windowMs

        if (hasTiers) {
          const tierName = await config.tier!(req)
          const tierConfig = config.tiers![tierName]
          if (tierConfig) {
            effectiveLimit = tierConfig.limit
            if (tierConfig.window) {
              effectiveWindowMs = parseWindow(tierConfig.window)
            }
          }
        }

        if (effectiveLimit === Infinity) {
          return null
        }

        const result = await store.hit(key, effectiveWindowMs, effectiveLimit)
        const allowed = result.count <= effectiveLimit

        if (!allowed) {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

          if (standardHeaders) {
            headers['RateLimit-Limit'] = String(effectiveLimit)
            headers['RateLimit-Remaining'] = '0'
            headers['RateLimit-Reset'] = String(resetIn)
          }
          if (legacyHeaders) {
            headers['X-RateLimit-Limit'] = String(effectiveLimit)
            headers['X-RateLimit-Remaining'] = '0'
            headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetAt / 1000))
          }
          if (retryAfterHeader) {
            headers['Retry-After'] = String(resetIn)
          }

          return new Response(blockedBody, { status: 429, headers })
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

function parseWindow(window: string | number): number {
  if (typeof window === 'number') return window

  const match = window.match(/^(\d+)(ms|s|m|h|d)$/)
  if (!match) return 60000

  const value = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 'ms': return value
    case 's': return value * 1000
    case 'm': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    case 'd': return value * 24 * 60 * 60 * 1000
    default: return 60000
  }
}
