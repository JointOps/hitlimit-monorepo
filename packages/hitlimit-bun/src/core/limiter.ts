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

// Resolve group-prefixed key
async function resolveKey<TRequest>(
  config: ResolvedConfig<TRequest>,
  req: TRequest
): Promise<{ key: string; groupId: string | undefined }> {
  let key = await config.key(req)
  let groupId: string | undefined

  if (config.group) {
    groupId = typeof config.group === 'function'
      ? await config.group(req)
      : config.group
    key = `group:${groupId}:${key}`
  }

  return { key, groupId }
}

// Resolve tier-specific limit and window
function resolveTier<TRequest>(
  config: ResolvedConfig<TRequest>,
  tierName: string | undefined
): { limit: number; windowMs: number } {
  if (tierName && config.tiers) {
    const tierConfig = config.tiers[tierName]
    if (tierConfig) {
      return {
        limit: tierConfig.limit,
        windowMs: tierConfig.window ? parseWindow(tierConfig.window) : config.windowMs
      }
    }
  }
  return { limit: config.limit, windowMs: config.windowMs }
}

// Optimized check for tiered limits - returns minimal object
export async function checkLimitFast<TRequest>(
  config: ResolvedConfig<TRequest>,
  req: TRequest
): Promise<FastResult> {
  const { key } = await resolveKey(config, req)

  let tierName: string | undefined
  if (config.tier && config.tiers) {
    tierName = await config.tier(req)
  }
  const { limit, windowMs } = resolveTier(config, tierName)

  // Check ban status
  if (config.ban && config.store.isBanned) {
    const banned = await config.store.isBanned(key)
    if (banned) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetIn: Math.ceil(config.ban.durationMs / 1000),
        resetAt: Date.now() + config.ban.durationMs
      }
    }
  }

  if (limit === Infinity) {
    return { allowed: true, limit, remaining: Infinity, resetIn: 0, resetAt: 0 }
  }

  const result = await config.store.hit(key, windowMs, limit)
  const now = Date.now()
  const allowed = result.count <= limit

  // Track violations for ban
  if (!allowed && config.ban && config.store.recordViolation) {
    const violations = await config.store.recordViolation(key, config.ban.durationMs)
    if (violations >= config.ban.threshold && config.store.ban) {
      await config.store.ban(key, config.ban.durationMs)
    }
  }

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - result.count),
    resetIn: Math.max(0, Math.ceil((result.resetAt - now) / 1000)),
    resetAt: result.resetAt
  }
}

// Full check with complete info object
export async function checkLimit<TRequest>(
  config: ResolvedConfig<TRequest>,
  req: TRequest
): Promise<HitLimitResult> {
  const { key, groupId } = await resolveKey(config, req)

  let tierName: string | undefined
  if (config.tier && config.tiers) {
    tierName = await config.tier(req)
  }
  const { limit, windowMs } = resolveTier(config, tierName)

  // Check ban status BEFORE hitting store
  if (config.ban && config.store.isBanned) {
    const banned = await config.store.isBanned(key)
    if (banned) {
      const banResetIn = Math.ceil(config.ban.durationMs / 1000)
      const info: HitLimitInfo = {
        limit,
        remaining: 0,
        resetIn: banResetIn,
        resetAt: Date.now() + config.ban.durationMs,
        key,
        tier: tierName,
        banned: true,
        banExpiresAt: Date.now() + config.ban.durationMs,
        group: groupId
      }
      return {
        allowed: false,
        info,
        headers: buildHeaders(info, config.headers, false),
        body: buildBody(config.response, info)
      }
    }
  }

  // Infinity limit skips store entirely (no violations possible)
  if (limit === Infinity) {
    return {
      allowed: true,
      info: { limit, remaining: Infinity, resetIn: 0, resetAt: 0, key, tier: tierName, group: groupId },
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
    tier: tierName,
    group: groupId
  }

  // Track violations and check ban threshold
  if (!allowed && config.ban && config.store.recordViolation) {
    const violations = await config.store.recordViolation(key, config.ban.durationMs)
    info.violations = violations
    if (violations >= config.ban.threshold && config.store.ban) {
      await config.store.ban(key, config.ban.durationMs)
      info.banned = true
      info.banExpiresAt = now + config.ban.durationMs
    }
  }

  return {
    allowed,
    info,
    headers: buildHeaders(info, config.headers, allowed),
    body: allowed ? {} : buildBody(config.response, info)
  }
}
