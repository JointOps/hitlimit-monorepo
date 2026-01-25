import type { Request, Response, NextFunction } from 'express'
import type { HitLimitOptions } from '@hitlimit/types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { memoryStore } from './stores/memory.js'

export type { HitLimitOptions, HitLimitInfo, HitLimitResult, HitLimitStore, StoreResult, TierConfig, HeadersConfig, ResolvedConfig, KeyGenerator, TierResolver, SkipFunction, StoreErrorHandler, ResponseFormatter, ResponseConfig } from '@hitlimit/types'
export { DEFAULT_LIMIT, DEFAULT_WINDOW, DEFAULT_WINDOW_MS, DEFAULT_MESSAGE } from '@hitlimit/types'
export { memoryStore } from './stores/memory.js'

function getDefaultKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

export function hitlimit(options: HitLimitOptions<Request> = {}) {
  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, getDefaultKey)

  return async (req: Request, res: Response, next: NextFunction) => {
    if (config.skip) {
      const shouldSkip = await config.skip(req)
      if (shouldSkip) {
        return next()
      }
    }

    try {
      const result = await checkLimit(config, req)

      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value)
      })

      if (!result.allowed) {
        res.status(429).json(result.body)
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
