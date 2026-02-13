import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'
import Redis from 'ioredis'

export interface RedisStoreOptions {
  url?: string
  keyPrefix?: string
}

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
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    const redisKey = this.prefix + key
    const now = Date.now()

    const results = await this.redis
      .multi()
      .incr(redisKey)
      .pttl(redisKey)
      .exec()

    const count = results![0][1] as number
    let ttl = results![1][1] as number

    if (ttl < 0) {
      await this.redis.pexpire(redisKey, windowMs)
      ttl = windowMs
    }

    const resetAt = now + ttl

    return { count, resetAt }
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
