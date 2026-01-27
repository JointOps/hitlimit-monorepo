import type { Request, Response, NextFunction } from 'express'
import type { HitLimitOptions, HitLimitInfo, ResponseConfig, ResponseFormatter } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { memoryStore } from './stores/memory.js'

export type { HitLimitOptions, HitLimitInfo, HitLimitResult, HitLimitStore, StoreResult, TierConfig, HeadersConfig, ResolvedConfig, KeyGenerator, TierResolver, SkipFunction, StoreErrorHandler, ResponseFormatter, ResponseConfig } from '@joint-ops/hitlimit-types'
export { DEFAULT_LIMIT, DEFAULT_WINDOW, DEFAULT_WINDOW_MS, DEFAULT_MESSAGE } from '@joint-ops/hitlimit-types'
export { memoryStore } from './stores/memory.js'
export { checkLimit } from './core/limiter.js'

function getDefaultKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

// Inline response builder for performance
function buildResponseBody(
  response: ResponseConfig | ResponseFormatter,
  info: HitLimitInfo
): Record<string, any> {
  if (typeof response === 'function') {
    return response(info)
  }
  return { ...response, limit: info.limit, remaining: info.remaining, resetIn: info.resetIn }
}

export function hitlimit(options: HitLimitOptions<Request> = {}) {
  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, getDefaultKey)

  // Pre-compute flags
  const hasSkip = !!config.skip
  const hasTiers = !!(config.tier && config.tiers)
  const standardHeaders = config.headers.standard
  const legacyHeaders = config.headers.legacy
  const retryAfterHeader = config.headers.retryAfter
  const limit = config.limit
  const windowMs = config.windowMs
  const responseConfig = config.response

  // Fast path: no skip, no tiers (most common case ~80%)
  if (!hasSkip && !hasTiers) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = await config.key(req)
        const result = await config.store.hit(key, windowMs, limit)
        const allowed = result.count <= limit
        const remaining = Math.max(0, limit - result.count)
        const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

        // Set headers directly
        if (standardHeaders) {
          res.setHeader('RateLimit-Limit', limit)
          res.setHeader('RateLimit-Remaining', remaining)
          res.setHeader('RateLimit-Reset', resetIn)
        }
        if (legacyHeaders) {
          res.setHeader('X-RateLimit-Limit', limit)
          res.setHeader('X-RateLimit-Remaining', remaining)
          res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000))
        }

        if (!allowed) {
          if (retryAfterHeader) {
            res.setHeader('Retry-After', resetIn)
          }
          const body = buildResponseBody(responseConfig, {
            limit, remaining: 0, resetIn, resetAt: result.resetAt, key
          })
          res.status(429).json(body)
          return
        }

        next()
      } catch (error) {
        const action = await config.onStoreError(error as Error, req)
        if (action === 'deny') {
          res.status(429).json({ hitlimit: true, message: 'Rate limit error' })
          return
        }
        next()
      }
    }
  }

  // Full path: with skip and/or tiers
  return async (req: Request, res: Response, next: NextFunction) => {
    if (hasSkip) {
      const shouldSkip = await config.skip!(req)
      if (shouldSkip) {
        return next()
      }
    }

    try {
      const key = await config.key(req)

      let effectiveLimit = limit
      let effectiveWindowMs = windowMs
      let tierName: string | undefined

      if (hasTiers) {
        tierName = await config.tier!(req)
        const tierConfig = config.tiers![tierName]
        if (tierConfig) {
          effectiveLimit = tierConfig.limit
          if (tierConfig.window) {
            effectiveWindowMs = parseWindow(tierConfig.window)
          }
        }
      }

      if (effectiveLimit === Infinity) {
        return next()
      }

      const result = await config.store.hit(key, effectiveWindowMs, effectiveLimit)
      const allowed = result.count <= effectiveLimit
      const remaining = Math.max(0, effectiveLimit - result.count)
      const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

      if (standardHeaders) {
        res.setHeader('RateLimit-Limit', effectiveLimit)
        res.setHeader('RateLimit-Remaining', remaining)
        res.setHeader('RateLimit-Reset', resetIn)
      }
      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', effectiveLimit)
        res.setHeader('X-RateLimit-Remaining', remaining)
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000))
      }

      if (!allowed) {
        if (retryAfterHeader) {
          res.setHeader('Retry-After', resetIn)
        }
        const body = buildResponseBody(responseConfig, {
          limit: effectiveLimit, remaining: 0, resetIn, resetAt: result.resetAt, key, tier: tierName
        })
        res.status(429).json(body)
        return
      }

      next()
    } catch (error) {
      const action = await config.onStoreError(error as Error, req)
      if (action === 'deny') {
        res.status(429).json({ hitlimit: true, message: 'Rate limit error' })
        return
      }
      next()
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
