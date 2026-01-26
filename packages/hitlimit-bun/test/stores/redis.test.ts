import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'bun:test'
import { redisStore } from '../../src/stores/redis'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

describe('RedisStore', () => {
  let store: HitLimitStore
  let isRedisAvailable = false

  beforeAll(async () => {
    try {
      const testStore = redisStore({ url: REDIS_URL })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 2000)
      )
      await Promise.race([
        testStore.hit('test', 1000, 1),
        timeout
      ])
      await testStore.reset('test')
      await testStore.shutdown?.()
      isRedisAvailable = true
    } catch {
      isRedisAvailable = false
    }
  })

  beforeEach(() => {
    if (!isRedisAvailable) return
    store = redisStore({ url: REDIS_URL, keyPrefix: `hitlimit:test:${Date.now()}:` })
  })

  afterEach(async () => {
    if (!isRedisAvailable) return
    await store.shutdown?.()
  })

  it('increments count on hit', async () => {
    if (!isRedisAvailable) return

    const result1 = await store.hit('key1', 60000, 100)
    expect(result1.count).toBe(1)

    const result2 = await store.hit('key1', 60000, 100)
    expect(result2.count).toBe(2)
  })

  it('handles multiple keys independently', async () => {
    if (!isRedisAvailable) return

    await store.hit('key1', 60000, 100)
    await store.hit('key1', 60000, 100)
    await store.hit('key2', 60000, 100)

    const result1 = await store.hit('key1', 60000, 100)
    const result2 = await store.hit('key2', 60000, 100)

    expect(result1.count).toBe(3)
    expect(result2.count).toBe(2)
  })

  it('resets specific key', async () => {
    if (!isRedisAvailable) return

    await store.hit('key1', 60000, 100)
    await store.hit('key1', 60000, 100)
    await store.reset('key1')

    const result = await store.hit('key1', 60000, 100)
    expect(result.count).toBe(1)
  })

  it('returns resetAt in the future', async () => {
    if (!isRedisAvailable) return

    const before = Date.now()
    const result = await store.hit('key1', 60000, 100)
    const after = Date.now()

    expect(result.resetAt).toBeGreaterThanOrEqual(before)
    expect(result.resetAt).toBeLessThanOrEqual(after + 60000)
  })

  it('sets TTL on new keys', async () => {
    if (!isRedisAvailable) return

    const result1 = await store.hit('key1', 5000, 100)
    const result2 = await store.hit('key1', 5000, 100)

    expect(result2.resetAt).toBeLessThanOrEqual(result1.resetAt + 100)
  })
})
