import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { redisStore } from '../../src/stores/redis.js'
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
  }, 5000)

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

describe('RedisStore Lua Scripts', () => {
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
  }, 5000)

  beforeEach(() => {
    if (!isRedisAvailable) return
    store = redisStore({ url: REDIS_URL, keyPrefix: `hitlimit:lua:${Date.now()}:` })
  })

  afterEach(async () => {
    if (!isRedisAvailable) return
    await store.shutdown?.()
  })

  describe('hitWithBan', () => {
    it('counts hits atomically', async () => {
      if (!isRedisAvailable) return

      const r1 = await store.hitWithBan!('k1', 60000, 10, 3, 60000)
      expect(r1.count).toBe(1)
      expect(r1.banned).toBe(false)
      expect(r1.violations).toBe(0)

      const r2 = await store.hitWithBan!('k1', 60000, 10, 3, 60000)
      expect(r2.count).toBe(2)
      expect(r2.banned).toBe(false)
    })

    it('tracks violations when over limit', async () => {
      if (!isRedisAvailable) return

      // Fill to limit
      for (let i = 0; i < 5; i++) {
        await store.hitWithBan!('k1', 60000, 5, 3, 60000)
      }

      // First violation
      const r = await store.hitWithBan!('k1', 60000, 5, 3, 60000)
      expect(r.count).toBe(6)
      expect(r.violations).toBe(1)
      expect(r.banned).toBe(false)
    })

    it('bans after reaching threshold', async () => {
      if (!isRedisAvailable) return

      // Fill to limit (2 hits, limit=2)
      await store.hitWithBan!('k1', 60000, 2, 3, 60000)
      await store.hitWithBan!('k1', 60000, 2, 3, 60000)

      // 3 violations to trigger ban (threshold=3)
      await store.hitWithBan!('k1', 60000, 2, 3, 60000) // violation 1
      await store.hitWithBan!('k1', 60000, 2, 3, 60000) // violation 2
      const r = await store.hitWithBan!('k1', 60000, 2, 3, 60000) // violation 3 → banned

      expect(r.violations).toBe(3)
      expect(r.banned).toBe(true)
      expect(r.banExpiresAt).toBeGreaterThan(Date.now())
    })

    it('returns banned status for already-banned keys', async () => {
      if (!isRedisAvailable) return

      // Fill + trigger ban
      await store.hitWithBan!('k1', 60000, 1, 1, 60000)
      await store.hitWithBan!('k1', 60000, 1, 1, 60000) // over limit + 1 violation → banned

      // Subsequent request should detect ban
      const r = await store.hitWithBan!('k1', 60000, 1, 1, 60000)
      expect(r.count).toBe(0) // count=0 signals "already banned"
      expect(r.banned).toBe(true)
      expect(r.banExpiresAt).toBeGreaterThan(Date.now())
    })

    it('independent keys do not share ban state', async () => {
      if (!isRedisAvailable) return

      // Ban key1
      await store.hitWithBan!('k1', 60000, 1, 1, 60000)
      await store.hitWithBan!('k1', 60000, 1, 1, 60000)

      // key2 should be unaffected
      const r = await store.hitWithBan!('k2', 60000, 1, 1, 60000)
      expect(r.count).toBe(1)
      expect(r.banned).toBe(false)
    })

    it('returns correct resetAt from TTL', async () => {
      if (!isRedisAvailable) return

      const before = Date.now()
      const r = await store.hitWithBan!('k1', 10000, 10, 3, 60000)
      const after = Date.now()

      expect(r.resetAt).toBeGreaterThanOrEqual(before)
      expect(r.resetAt).toBeLessThanOrEqual(after + 10000)
    })
  })

  describe('isBanned / ban / recordViolation', () => {
    it('isBanned returns false for non-banned keys', async () => {
      if (!isRedisAvailable) return

      const result = await store.isBanned!('k1')
      expect(result).toBe(false)
    })

    it('ban + isBanned round-trip', async () => {
      if (!isRedisAvailable) return

      await store.ban!('k1', 60000)
      const result = await store.isBanned!('k1')
      expect(result).toBe(true)
    })

    it('recordViolation increments', async () => {
      if (!isRedisAvailable) return

      const v1 = await store.recordViolation!('k1', 60000)
      expect(v1).toBe(1)

      const v2 = await store.recordViolation!('k1', 60000)
      expect(v2).toBe(2)
    })

    it('reset clears hit, ban, and violation keys', async () => {
      if (!isRedisAvailable) return

      await store.hit('k1', 60000, 10)
      await store.ban!('k1', 60000)
      await store.recordViolation!('k1', 60000)

      await store.reset('k1')

      const hit = await store.hit('k1', 60000, 10)
      expect(hit.count).toBe(1) // fresh start

      const banned = await store.isBanned!('k1')
      expect(banned).toBe(false)
    })
  })

  describe('concurrent atomicity', () => {
    it('concurrent hits produce sequential counts', async () => {
      if (!isRedisAvailable) return

      const promises = Array.from({ length: 20 }, () =>
        store.hit('concurrent', 60000, 100)
      )
      const results = await Promise.all(promises)
      const counts = results.map(r => r.count).sort((a, b) => a - b)

      // All 20 counts should be unique and sequential (1..20)
      expect(counts).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    })

    it('concurrent hitWithBan produces correct violation count', async () => {
      if (!isRedisAvailable) return

      // limit=1, so after first hit, all others are violations
      // Fire 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        store.hitWithBan!('conc-ban', 60000, 1, 100, 60000)
      )
      const results = await Promise.all(promises)
      const counts = results.map(r => r.count).sort((a, b) => a - b)

      // Counts should be 1..10
      expect(counts).toEqual(Array.from({ length: 10 }, (_, i) => i + 1))

      // Exactly 9 should be over limit (counts 2-10)
      const overLimit = results.filter(r => r.count > 1)
      expect(overLimit.length).toBe(9)
    })
  })
})
