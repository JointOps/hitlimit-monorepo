import type { HitLimitStore, StoreResult } from '@hitlimit/types'
import Redis from 'ioredis'

export interface RedisStoreOptions {
  url?: string
  keyPrefix?: string
}

class RedisStore implements HitLimitStore {
  private redis: Redis
  private prefix: string

  constructor(options: RedisStoreOptions = {}) {
    this.redis = new Redis(options.url ?? 'redis://localhost:6379')
    this.prefix = options.keyPrefix ?? 'hitlimit:'
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

  async reset(key: string): Promise<void> {
    await this.redis.del(this.prefix + key)
  }

  async shutdown(): Promise<void> {
    await this.redis.quit()
  }
}

export function redisStore(options?: RedisStoreOptions): HitLimitStore {
  return new RedisStore(options)
}
