import { describe, it, expect, vi } from 'vitest'
import { checkLimit } from '../../src/core/limiter.js'
import type { ResolvedConfig, HitLimitStore } from '@joint-ops/hitlimit-types'

const createMockStore = (count: number, resetAt: number): HitLimitStore => ({
  hit: vi.fn().mockReturnValue({ count, resetAt }),
  reset: vi.fn()
})

const createConfig = (overrides: Partial<ResolvedConfig<any>> = {}): ResolvedConfig<any> => ({
  limit: 100,
  windowMs: 60000,
  key: () => 'test-key',
  response: { hitlimit: true, message: 'Rate limited' },
  headers: { standard: true, legacy: true, retryAfter: true },
  store: createMockStore(1, Date.now() + 60000),
  onStoreError: () => 'allow',
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
    const store: HitLimitStore = {
      hit: vi.fn().mockReturnValue({ count: 1, resetAt: Date.now() + 3600000 }),
      reset: vi.fn()
    }
    const config = createConfig({
      windowMs: 60000,
      tiers: { hourly: { limit: 100, window: '1h' } },
      tier: () => 'hourly',
      store
    })

    await checkLimit(config, {})

    expect(store.hit).toHaveBeenCalledWith(expect.any(String), 3600000, 100)
  })
})
