import { describe, it, expect, mock } from 'bun:test'
import { checkLimit, checkLimitFast } from '../../src/core/limiter'
import type { ResolvedConfig, HitLimitStore } from '@joint-ops/hitlimit-types'

const createMockStore = (count: number, resetAt: number): HitLimitStore => ({
  hit: mock(() => ({ count, resetAt })),
  reset: mock(() => {})
})

const createConfig = (overrides: Partial<ResolvedConfig<any>> = {}): ResolvedConfig<any> => ({
  limit: 100,
  windowMs: 60000,
  key: () => 'test-key',
  response: { hitlimit: true, message: 'Rate limited' },
  headers: { standard: true, legacy: true, retryAfter: true },
  store: createMockStore(1, Date.now() + 60000),
  onStoreError: () => 'allow',
  ban: null,
  group: null,
  ...overrides
})

describe('checkLimit', () => {
  it('allows request when under limit', async () => {
    const config = createConfig({
      store: createMockStore(1, Date.now() + 60000)
    })

    const result = await checkLimit(config, {})

    expect(result.allowed).toBe(true)
    expect(result.info.remaining).toBe(99)
    expect(result.body).toEqual({})
  })

  it('blocks request when at limit', async () => {
    const config = createConfig({
      limit: 10,
      store: createMockStore(11, Date.now() + 60000)
    })

    const result = await checkLimit(config, {})

    expect(result.allowed).toBe(false)
    expect(result.info.remaining).toBe(0)
    expect(result.body.hitlimit).toBe(true)
  })

  it('includes headers in result', async () => {
    const config = createConfig()
    const result = await checkLimit(config, {})

    expect(result.headers['RateLimit-Limit']).toBe('100')
    expect(result.headers['X-RateLimit-Limit']).toBe('100')
  })

  it('resolves tier limits', async () => {
    const config = createConfig({
      tiers: {
        free: { limit: 10, window: '1h' },
        pro: { limit: 1000 }
      },
      tier: () => 'free',
      store: createMockStore(5, Date.now() + 3600000)
    })

    const result = await checkLimit(config, {})

    expect(result.info.limit).toBe(10)
    expect(result.info.tier).toBe('free')
    expect(result.info.remaining).toBe(5)
  })

  it('handles async key function', async () => {
    const store = createMockStore(1, Date.now() + 60000)
    const config = createConfig({
      key: async () => 'async-key',
      store
    })

    const result = await checkLimit(config, {})

    expect(result.info.key).toBe('async-key')
    expect(store.hit).toHaveBeenCalled()
  })

  it('handles async tier function', async () => {
    const config = createConfig({
      tiers: { premium: { limit: 500 } },
      tier: async () => 'premium',
      store: createMockStore(1, Date.now() + 60000)
    })

    const result = await checkLimit(config, {})

    expect(result.info.tier).toBe('premium')
    expect(result.info.limit).toBe(500)
  })

  it('handles Infinity limit', async () => {
    const store = createMockStore(1, Date.now())
    const config = createConfig({
      tiers: { enterprise: { limit: Infinity } },
      tier: () => 'enterprise',
      store
    })

    const result = await checkLimit(config, {})

    expect(result.allowed).toBe(true)
    expect(result.info.limit).toBe(Infinity)
    expect(result.info.remaining).toBe(Infinity)
    expect(result.headers).toEqual({})
    expect(store.hit).not.toHaveBeenCalled()
  })

  it('calculates resetIn correctly', async () => {
    const now = Date.now()
    const resetAt = now + 30000
    const config = createConfig({
      store: createMockStore(1, resetAt)
    })

    const result = await checkLimit(config, {})

    expect(result.info.resetIn).toBeGreaterThanOrEqual(29)
    expect(result.info.resetIn).toBeLessThanOrEqual(30)
  })

  it('remaining never goes below 0', async () => {
    const config = createConfig({
      limit: 5,
      store: createMockStore(10, Date.now() + 60000)
    })

    const result = await checkLimit(config, {})

    expect(result.info.remaining).toBe(0)
  })

  it('uses tier window when specified', async () => {
    const hitFn = mock(() => ({ count: 1, resetAt: Date.now() + 3600000 }))
    const store: HitLimitStore = {
      hit: hitFn,
      reset: mock(() => {})
    }
    const config = createConfig({
      windowMs: 60000,
      tiers: { hourly: { limit: 100, window: '1h' } },
      tier: () => 'hourly',
      store
    })

    await checkLimit(config, {})

    expect(hitFn).toHaveBeenCalledWith(expect.any(String), 3600000, 100)
  })

  it('uses default limit when tier not found', async () => {
    const config = createConfig({
      limit: 50,
      tiers: { pro: { limit: 1000 } },
      tier: () => 'unknown',
      store: createMockStore(1, Date.now() + 60000)
    })

    const result = await checkLimit(config, {})

    expect(result.info.limit).toBe(50)
  })

  it('includes body only when blocked', async () => {
    const allowedConfig = createConfig({
      store: createMockStore(1, Date.now() + 60000)
    })
    const allowedResult = await checkLimit(allowedConfig, {})
    expect(allowedResult.body).toEqual({})

    const blockedConfig = createConfig({
      limit: 1,
      store: createMockStore(2, Date.now() + 60000)
    })
    const blockedResult = await checkLimit(blockedConfig, {})
    expect(blockedResult.body.hitlimit).toBe(true)
  })

  it('handles exact limit boundary', async () => {
    const config = createConfig({
      limit: 10,
      store: createMockStore(10, Date.now() + 60000)
    })

    const result = await checkLimit(config, {})

    expect(result.allowed).toBe(true)
    expect(result.info.remaining).toBe(0)
  })

  it('blocks at limit + 1', async () => {
    const config = createConfig({
      limit: 10,
      store: createMockStore(11, Date.now() + 60000)
    })

    const result = await checkLimit(config, {})

    expect(result.allowed).toBe(false)
  })

  describe('ban support', () => {
    it('blocks banned users before hitting store', async () => {
      const store: HitLimitStore = {
        hit: mock(() => ({ count: 1, resetAt: Date.now() + 60000 })),
        reset: mock(() => {}),
        isBanned: mock(() => true),
        ban: mock(() => {}),
        recordViolation: mock(() => 1)
      }
      const config = createConfig({
        store,
        ban: { threshold: 3, durationMs: 3600000 }
      })

      const result = await checkLimit(config, {})

      expect(result.allowed).toBe(false)
      expect(result.info.banned).toBe(true)
      expect(result.info.banExpiresAt).toBeDefined()
      expect(result.headers['X-RateLimit-Ban']).toBe('true')
      expect(store.hit).not.toHaveBeenCalled()
    })

    it('records violation on rate limit exceeded', async () => {
      const recordViolation = mock(() => 1)
      const store: HitLimitStore = {
        hit: mock(() => ({ count: 11, resetAt: Date.now() + 60000 })),
        reset: mock(() => {}),
        isBanned: mock(() => false),
        ban: mock(() => {}),
        recordViolation
      }
      const config = createConfig({
        limit: 10,
        store,
        ban: { threshold: 3, durationMs: 3600000 }
      })

      const result = await checkLimit(config, {})

      expect(result.allowed).toBe(false)
      expect(recordViolation).toHaveBeenCalled()
      expect(result.info.violations).toBe(1)
    })

    it('bans user after threshold violations', async () => {
      const banFn = mock(() => {})
      const store: HitLimitStore = {
        hit: mock(() => ({ count: 11, resetAt: Date.now() + 60000 })),
        reset: mock(() => {}),
        isBanned: mock(() => false),
        ban: banFn,
        recordViolation: mock(() => 3)
      }
      const config = createConfig({
        limit: 10,
        store,
        ban: { threshold: 3, durationMs: 3600000 }
      })

      const result = await checkLimit(config, {})

      expect(banFn).toHaveBeenCalledWith('test-key', 3600000)
      expect(result.info.banned).toBe(true)
    })

    it('does not ban when violations under threshold', async () => {
      const banFn = mock(() => {})
      const store: HitLimitStore = {
        hit: mock(() => ({ count: 11, resetAt: Date.now() + 60000 })),
        reset: mock(() => {}),
        isBanned: mock(() => false),
        ban: banFn,
        recordViolation: mock(() => 2)
      }
      const config = createConfig({
        limit: 10,
        store,
        ban: { threshold: 3, durationMs: 3600000 }
      })

      await checkLimit(config, {})

      expect(banFn).not.toHaveBeenCalled()
    })
  })

  describe('group support', () => {
    it('prefixes key with static group', async () => {
      const store: HitLimitStore = {
        hit: mock(() => ({ count: 1, resetAt: Date.now() + 60000 })),
        reset: mock(() => {})
      }
      const config = createConfig({
        store,
        group: 'api'
      })

      const result = await checkLimit(config, {})

      expect(store.hit).toHaveBeenCalledWith('group:api:test-key', 60000, 100)
      expect(result.info.group).toBe('api')
    })

    it('prefixes key with dynamic group', async () => {
      const store: HitLimitStore = {
        hit: mock(() => ({ count: 1, resetAt: Date.now() + 60000 })),
        reset: mock(() => {})
      }
      const config = createConfig({
        store,
        group: (req: any) => req.tenant
      })

      const result = await checkLimit(config, { tenant: 'acme' })

      expect(store.hit).toHaveBeenCalledWith('group:acme:test-key', 60000, 100)
      expect(result.info.group).toBe('acme')
    })

    it('does not prefix key when group is null', async () => {
      const store: HitLimitStore = {
        hit: mock(() => ({ count: 1, resetAt: Date.now() + 60000 })),
        reset: mock(() => {})
      }
      const config = createConfig({
        store,
        group: null
      })

      await checkLimit(config, {})

      expect(store.hit).toHaveBeenCalledWith('test-key', 60000, 100)
    })
  })
})

describe('checkLimitFast', () => {
  it('allows request when under limit', async () => {
    const config = createConfig({
      store: createMockStore(1, Date.now() + 60000)
    })

    const result = await checkLimitFast(config, {})

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(99)
    expect(result.limit).toBe(100)
  })

  it('blocks request when at limit', async () => {
    const config = createConfig({
      limit: 10,
      store: createMockStore(11, Date.now() + 60000)
    })

    const result = await checkLimitFast(config, {})

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.limit).toBe(10)
  })

  it('handles Infinity limit', async () => {
    const config = createConfig({
      limit: Infinity
    })

    const result = await checkLimitFast(config, {})

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(Infinity)
    expect(result.limit).toBe(Infinity)
  })

  it('blocks banned users before hitting store', async () => {
    const store: HitLimitStore = {
      ...createMockStore(1, Date.now() + 60000),
      isBanned: mock(() => true),
      ban: mock(() => {}),
      recordViolation: mock(() => 1)
    }

    const config = createConfig({
      store,
      ban: { threshold: 2, durationMs: 3600000 }
    })

    const result = await checkLimitFast(config, {})

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(store.hit).not.toHaveBeenCalled()
  })

  it('records violations when limit exceeded', async () => {
    const store: HitLimitStore = {
      ...createMockStore(11, Date.now() + 60000),
      isBanned: mock(() => false),
      ban: mock(() => {}),
      recordViolation: mock(() => 1)
    }

    const config = createConfig({
      limit: 10,
      store,
      ban: { threshold: 2, durationMs: 3600000 }
    })

    const result = await checkLimitFast(config, {})

    expect(result.allowed).toBe(false)
    expect(store.recordViolation).toHaveBeenCalledWith('test-key', 3600000)
  })

  it('bans user after threshold violations', async () => {
    const store: HitLimitStore = {
      ...createMockStore(11, Date.now() + 60000),
      isBanned: mock(() => false),
      ban: mock(() => {}),
      recordViolation: mock(() => 2)
    }

    const config = createConfig({
      limit: 10,
      store,
      ban: { threshold: 2, durationMs: 3600000 }
    })

    await checkLimitFast(config, {})

    expect(store.recordViolation).toHaveBeenCalledWith('test-key', 3600000)
    expect(store.ban).toHaveBeenCalledWith('test-key', 3600000)
  })
})
