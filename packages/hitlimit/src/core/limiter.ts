import type { HitLimitInfo, HitLimitResult, ResolvedConfig } from '@hitlimit/types'
import { parseWindow, hashKey } from './utils.js'
import { buildHeaders } from './headers.js'
import { buildBody } from './response.js'

export async function checkLimit<TRequest>(
  config: ResolvedConfig<TRequest>,
  req: TRequest
): Promise<HitLimitResult> {
  const rawKey = await config.key(req)
  const key = hashKey(rawKey)

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
      info: { limit, remaining: Infinity, resetIn: 0, resetAt: 0, key: rawKey, tier: tierName },
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
    key: rawKey,
    tier: tierName
  }

  return {
    allowed,
    info,
    headers: buildHeaders(info, config.headers, allowed),
    body: allowed ? {} : buildBody(config.response, info)
  }
}
