import type { HitLimitStore, HitWithBanResult, StoreResult } from '@joint-ops/hitlimit-types'
import Redis from 'ioredis'

export interface RedisStoreOptions {
  url?: string
  keyPrefix?: string
}

// Lua script: atomic hit (no ban) — INCR + PEXPIRE + PTTL in 1 call
const HIT_SCRIPT = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])
local count = redis.call('INCR', key)
local ttl = redis.call('PTTL', key)
if ttl < 0 then
  redis.call('PEXPIRE', key, windowMs)
  ttl = windowMs
end
return {count, ttl}
`

// Lua script: atomic hit + ban check + violation tracking in 1 call
const HIT_WITH_BAN_SCRIPT = `
local hitKey = KEYS[1]
local banKey = KEYS[2]
local violationKey = KEYS[3]
local windowMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local banThreshold = tonumber(ARGV[3])
local banDurationMs = tonumber(ARGV[4])

-- Check ban first
local banTTL = redis.call('PTTL', banKey)
if banTTL > 0 then
  return {-1, banTTL, 1, 0}
end

-- Hit counter
local count = redis.call('INCR', hitKey)
local ttl = redis.call('PTTL', hitKey)
if ttl < 0 then
  redis.call('PEXPIRE', hitKey, windowMs)
  ttl = windowMs
end

-- Track violations if over limit
local banned = 0
local violations = 0
if count > limit then
  violations = redis.call('INCR', violationKey)
  local vTTL = redis.call('PTTL', violationKey)
  if vTTL < 0 then
    redis.call('PEXPIRE', violationKey, banDurationMs)
  end
  if violations >= banThreshold then
    redis.call('SET', banKey, '1', 'PX', banDurationMs)
    banned = 1
  end
end
return {count, ttl, banned, violations}
`

class RedisStore implements HitLimitStore {
  private redis: Redis
  private prefix: string
  private banPrefix: string
  private violationPrefix: string

  constructor(options: RedisStoreOptions = {}) {
    this.redis = new Redis(options.url ?? 'redis://localhost:6379')
    this.prefix = options.keyPrefix ?? 'hitlimit:'
    this.banPrefix = (options.keyPrefix ?? 'hitlimit:') + 'ban:'
    this.violationPrefix = (options.keyPrefix ?? 'hitlimit:') + 'violations:'

    // Register Lua scripts as custom commands — ioredis handles SHA caching + NOSCRIPT recovery
    this.redis.defineCommand('hitlimitHit', {
      numberOfKeys: 1,
      lua: HIT_SCRIPT
    })
    this.redis.defineCommand('hitlimitHitWithBan', {
      numberOfKeys: 3,
      lua: HIT_WITH_BAN_SCRIPT
    })
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    const redisKey = this.prefix + key
    const result = await (this.redis as any).hitlimitHit(redisKey, windowMs)

    const count = result[0] as number
    const ttl = result[1] as number
    return { count, resetAt: Date.now() + ttl }
  }

  async hitWithBan(key: string, windowMs: number, limit: number, banThreshold: number, banDurationMs: number): Promise<HitWithBanResult> {
    const hitKey = this.prefix + key
    const banKey = this.banPrefix + key
    const violationKey = this.violationPrefix + key

    const result = await (this.redis as any).hitlimitHitWithBan(
      hitKey, banKey, violationKey,
      windowMs, limit, banThreshold, banDurationMs
    )

    const count = result[0] as number
    const ttl = result[1] as number
    const banned = result[2] === 1
    const violations = result[3] as number

    if (count === -1) {
      return { count: 0, resetAt: Date.now() + ttl, banned: true, violations: 0, banExpiresAt: Date.now() + ttl }
    }

    return {
      count,
      resetAt: Date.now() + ttl,
      banned,
      violations,
      banExpiresAt: banned ? Date.now() + banDurationMs : 0
    }
  }

  async isBanned(key: string): Promise<boolean> {
    const result = await this.redis.exists(this.banPrefix + key)
    return result === 1
  }

  async ban(key: string, durationMs: number): Promise<void> {
    await this.redis.set(this.banPrefix + key, '1', 'PX', durationMs)
  }

  async recordViolation(key: string, windowMs: number): Promise<number> {
    const redisKey = this.violationPrefix + key
    const count = await this.redis.incr(redisKey)
    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs)
    }
    return count
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(
      this.prefix + key,
      this.banPrefix + key,
      this.violationPrefix + key
    )
  }

  async shutdown(): Promise<void> {
    await this.redis.quit()
  }
}

export function redisStore(options?: RedisStoreOptions): HitLimitStore {
  return new RedisStore(options)
}
