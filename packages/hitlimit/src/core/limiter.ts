import type { HitLimitInfo, HitLimitResult, ResolvedConfig } from '@joint-ops/hitlimit-types'
import { parseWindow } from './utils.js'
import { buildHeaders } from './headers.js'
import { buildBody } from './response.js'

// Fast result for optimized path - minimal object creation
export interface FastResult {
  allowed: boolean
  limit: number
  remaining: number
  resetIn: number
  resetAt: number
}

// Optimized check for tiered limits - returns minimal object
export async function checkLimitFast<TRequest>(
  config: ResolvedConfig<TRequest>,
  req: TRequest
): Promise<FastResult> {
  const key = await config.key(req)

  let limit = config.limit
  let windowMs = config.windowMs

  if (config.tier && config.tiers) {
    const tierName = await config.tier(req)
    const tierConfig = config.tiers[tierName]
    if (tierConfig) {
      limit = tierConfig.limit
      if (tierConfig.window) {
        windowMs = parseWindow(tierConfig.window)
      }
    }
  }

  if (limit === Infinity) {
    return { allowed: true, limit, remaining: Infinity, resetIn: 0, resetAt: 0 }
  }

  const result = await config.store.hit(key, windowMs, limit)
  const now = Date.now()

  return {
    allowed: result.count <= limit,
    limit,
    remaining: Math.max(0, limit - result.count),
    resetIn: Math.max(0, Math.ceil((result.resetAt - now) / 1000)),
    resetAt: result.resetAt
  }
}

// Original full check - used for testing and backwards compatibility
export async function checkLimit<TRequest>(
  config: ResolvedConfig<TRequest>,
  req: TRequest
): Promise<HitLimitResult> {
  // Use raw key directly - no hashing needed for rate limit keys
  const key = await config.key(req)

  let limit = config.limit
  let windowMs = config.windowMs
  let tierName: string | undefined

  if (config.tier && config.tiers) {
    tierName = await config.tier(req)
    const tierConfig = config.tiers[tierName]
    if (tierConfig) {
      limit = tierConfig.limit
      if (tierConfig.window) {
        windowMs = parseWindow(tierConfig.window)
      }
    }
  }

  if (limit === Infinity) {
    return {
      allowed: true,
      info: { limit, remaining: Infinity, resetIn: 0, resetAt: 0, key, tier: tierName },
      headers: {},
      body: {}
    }
  }

  const result = await config.store.hit(key, windowMs, limit)
  const now = Date.now()
  const resetIn = Math.max(0, Math.ceil((result.resetAt - now) / 1000))
  const remaining = Math.max(0, limit - result.count)
  const allowed = result.count <= limit

  const info: HitLimitInfo = {
    limit,
    remaining,
    resetIn,
    resetAt: result.resetAt,
    key,
    tier: tierName
  }

  return {
    allowed,
    info,
    headers: buildHeaders(info, config.headers, allowed),
    body: allowed ? {} : buildBody(config.response, info)
  }
}
