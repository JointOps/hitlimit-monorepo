import type { IncomingMessage } from 'http'
import type { HitLimitOptions, HitLimitResult } from '@joint-ops/hitlimit-types'
import { resolveConfig } from './core/config.js'
import { checkLimit } from './core/limiter.js'
import { memoryStore } from './stores/memory.js'

export type { HitLimitOptions, HitLimitInfo, HitLimitResult, HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'
export { memoryStore } from './stores/memory.js'

function getDefaultKey(req: IncomingMessage): string {
  return req.socket?.remoteAddress || 'unknown'
}

export interface HitLimiter {
  check(req: IncomingMessage): Promise<HitLimitResult>
  reset(key: string): Promise<void> | void
}

export function createHitLimit(options: HitLimitOptions<IncomingMessage> = {}): HitLimiter {
  const store = options.store ?? memoryStore()
  const config = resolveConfig(options, store, getDefaultKey)

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
