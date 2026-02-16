import type { IncomingMessage } from 'http'
import type { HitLimitOptions, HitLimitResult, StoreResult } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { buildHeaders } from './core/headers.js'
import { buildBody } from './core/response.js'
import { memoryStore } from './stores/memory.js'

export type { HitLimitOptions, HitLimitInfo, HitLimitResult, HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'
export { memoryStore } from './stores/memory.js'

function getDefaultKey(req: IncomingMessage): string {
  return req.socket?.remoteAddress || 'unknown'
}

export interface HitLimiter {
  check(req: IncomingMessage): HitLimitResult | Promise<HitLimitResult>
  reset(key: string): Promise<void> | void
}

export function createHitLimit(options: HitLimitOptions<IncomingMessage> = {}): HitLimiter {
  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, getDefaultKey)

  const hasSkip = !!config.skip
  const hasTiers = !!(config.tier && config.tiers)
  const hasBan = !!config.ban
  const hasGroup = !!config.group
  const isSyncStore = store.isSync === true
  const isSyncKey = !options.key

  // Sync fast path: sync store + default key + no skip/tiers/ban/group
  if (!hasSkip && !hasTiers && !hasBan && !hasGroup && isSyncStore && isSyncKey) {
    return {
      check(req: IncomingMessage): HitLimitResult {
        const key = req.socket?.remoteAddress || 'unknown'
        const result = store.hit(key, config.windowMs, config.limit) as StoreResult
        const allowed = result.count <= config.limit
        const remaining = Math.max(0, config.limit - result.count)
        const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)

        const info = {
          limit: config.limit, remaining, resetIn, resetAt: result.resetAt, key
        }
        const headers = buildHeaders(info, config.headers, allowed)
        const body = allowed ? {} : buildBody(config.response, info)

        return { allowed, info, headers, body }
      },

      reset(key: string) {
        return store.reset(key)
      }
    }
  }

  // Full async path
  return {
    async check(req: IncomingMessage): Promise<HitLimitResult> {
      if (config.skip) {
        const shouldSkip = await config.skip(req)
        if (shouldSkip) {
          return {
            allowed: true,
            info: { limit: config.limit, remaining: config.limit, resetIn: 0, resetAt: 0, key: '' },
            headers: {},
            body: {}
          }
        }
      }

      try {
        return await checkLimit(config, req)
      } catch (error) {
        const action = await config.onStoreError(error as Error, req)
        if (action === 'deny') {
          return {
            allowed: false,
            info: { limit: config.limit, remaining: 0, resetIn: 0, resetAt: 0, key: '' },
            headers: {},
            body: { hitlimit: true, message: 'Rate limit error' }
          }
        }
        return {
          allowed: true,
          info: { limit: config.limit, remaining: config.limit, resetIn: 0, resetAt: 0, key: '' },
          headers: {},
          body: {}
        }
      }
    },

    reset(key: string) {
      return store.reset(key)
    }
  }
}
