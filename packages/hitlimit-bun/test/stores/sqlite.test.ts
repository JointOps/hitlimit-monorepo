import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { sqliteStore } from '../../src/stores/sqlite'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

describe('BunSqliteStore', () => {
  let store: HitLimitStore

  beforeEach(() => {
    store = sqliteStore()
  })

  afterEach(() => {
    store.shutdown?.()
  })

  it('increments count on hit', () => {
    const result1 = store.hit('key1', 60000, 100)
    expect(result1.count).toBe(1)

    const result2 = store.hit('key1', 60000, 100)
    expect(result2.count).toBe(2)
  })

  it('resets count after window expires', async () => {
    const result1 = store.hit('key1', 100, 100)
    expect(result1.count).toBe(1)

    await Bun.sleep(150)

    const result2 = store.hit('key1', 100, 100)
    expect(result2.count).toBe(1)
  })

  it('handles multiple keys independently', () => {
    store.hit('key1', 60000, 100)
    store.hit('key1', 60000, 100)
    store.hit('key2', 60000, 100)

    expect(store.hit('key1', 60000, 100).count).toBe(3)
    expect(store.hit('key2', 60000, 100).count).toBe(2)
  })

  it('resets specific key', () => {
    store.hit('key1', 60000, 100)
    store.hit('key1', 60000, 100)
    store.reset('key1')

    expect(store.hit('key1', 60000, 100).count).toBe(1)
  })

  it('returns correct resetAt', () => {
    const before = Date.now()
    const result = store.hit('key1', 60000, 100)
    const after = Date.now()

    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000)
    expect(result.resetAt).toBeLessThanOrEqual(after + 60000)
  })

  it('persists data across multiple operations', () => {
    for (let i = 1; i <= 100; i++) {
      const result = store.hit('persist-key', 60000, 100)
      expect(result.count).toBe(i)
    }

    const finalResult = store.hit('persist-key', 60000, 100)
    expect(finalResult.count).toBe(101)
  })

  describe('ban methods', () => {
    it('isBanned returns false by default', () => {
      expect(store.isBanned!('key1')).toBe(false)
    })

    it('ban + isBanned works', () => {
      store.ban!('key1', 60000)
      expect(store.isBanned!('key1')).toBe(true)
    })

    it('ban expires', async () => {
      store.ban!('key1', 100)
      expect(store.isBanned!('key1')).toBe(true)

      await Bun.sleep(150)

      expect(store.isBanned!('key1')).toBe(false)
    })

    it('reset clears ban', () => {
      store.ban!('key1', 60000)
      store.reset('key1')
      expect(store.isBanned!('key1')).toBe(false)
    })
  })

  describe('violation methods', () => {
    it('recordViolation increments count', () => {
      expect(store.recordViolation!('key1', 60000)).toBe(1)
      expect(store.recordViolation!('key1', 60000)).toBe(2)
      expect(store.recordViolation!('key1', 60000)).toBe(3)
    })

    it('violation window resets after expiry', async () => {
      store.recordViolation!('key1', 100)
      store.recordViolation!('key1', 100)

      await Bun.sleep(150)

      expect(store.recordViolation!('key1', 100)).toBe(1)
    })

    it('reset clears violations', () => {
      store.recordViolation!('key1', 60000)
      store.recordViolation!('key1', 60000)
      store.reset('key1')
      expect(store.recordViolation!('key1', 60000)).toBe(1)
    })
  })
})
