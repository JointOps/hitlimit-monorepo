import { describe, it, expect } from 'vitest'
import { resolveConfig } from '../../src/core/config.js'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

const mockStore: HitLimitStore = {
  hit: () => ({ count: 1, resetAt: Date.now() + 60000 }),
  reset: () => {}
}

const defaultKey = () => 'test-key'

describe('resolveConfig', () => {
  it('uses default values when no options provided', () => {
    const config = resolveConfig({}, mockStore, defaultKey)

    expect(config.limit).toBe(100)
    expect(config.windowMs).toBe(60000)
    expect(config.key).toBe(defaultKey)
    expect(config.store).toBe(mockStore)
    expect(config.headers.standard).toBe(true)
    expect(config.headers.legacy).toBe(true)
    expect(config.headers.retryAfter).toBe(true)
  })

  it('uses provided limit and window', () => {
    const config = resolveConfig({ limit: 50, window: '15m' }, mockStore, defaultKey)

    expect(config.limit).toBe(50)
    expect(config.windowMs).toBe(900000)
  })

  it('uses custom key function', () => {
    const customKey = () => 'custom-key'
    const config = resolveConfig({ key: customKey }, mockStore, defaultKey)

    expect(config.key).toBe(customKey)
  })

  it('preserves tiers configuration', () => {
    const tiers = {
      free: { limit: 100, window: '1h' },
      pro: { limit: 5000 }
    }
    const config = resolveConfig({ tiers }, mockStore, defaultKey)

    expect(config.tiers).toBe(tiers)
  })

  it('uses custom response', () => {
    const response = { error: 'RATE_LIMITED' }
    const config = resolveConfig({ response }, mockStore, defaultKey)

    expect(config.response).toBe(response)
  })

  it('configures headers individually', () => {
    const config = resolveConfig(
      { headers: { standard: false, legacy: true, retryAfter: false } },
      mockStore,
      defaultKey
    )

    expect(config.headers.standard).toBe(false)
    expect(config.headers.legacy).toBe(true)
    expect(config.headers.retryAfter).toBe(false)
  })

  it('uses custom onStoreError handler', () => {
    const onStoreError = () => 'deny' as const
    const config = resolveConfig({ onStoreError }, mockStore, defaultKey)

    expect(config.onStoreError).toBe(onStoreError)
  })

  it('default onStoreError returns allow', () => {
    const config = resolveConfig({}, mockStore, defaultKey)
    const result = config.onStoreError(new Error('test'), {})

    expect(result).toBe('allow')
  })

  it('preserves skip function', () => {
    const skip = () => true
    const config = resolveConfig({ skip }, mockStore, defaultKey)

    expect(config.skip).toBe(skip)
  })
})
