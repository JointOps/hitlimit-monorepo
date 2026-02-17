import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { memoryStore } from '../../src/stores/memory.js'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

describe('MemoryStore', () => {
  let store: HitLimitStore

  beforeEach(() => {
    store = memoryStore()
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

    await new Promise(resolve => setTimeout(resolve, 150))

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

  it('maintains resetAt on subsequent hits', () => {
    const result1 = store.hit('key1', 60000, 100)
    const result2 = store.hit('key1', 60000, 100)

    expect(result1.resetAt).toBe(result2.resetAt)
  })

  it('can be shutdown', () => {
    store.hit('key1', 60000, 100)
    store.shutdown?.()

    const result = store.hit('key1', 60000, 100)
    expect(result.count).toBe(1)
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

      await new Promise(resolve => setTimeout(resolve, 150))

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

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(store.recordViolation!('key1', 100)).toBe(1)
    })

    it('reset clears violations', () => {
      store.recordViolation!('key1', 60000)
      store.recordViolation!('key1', 60000)
      store.reset('key1')
      expect(store.recordViolation!('key1', 60000)).toBe(1)
    })
  })

  describe('zero-allocation result reuse', () => {
    it('returns same object reference from consecutive hits', () => {
      const result1 = store.hit('key1', 60000, 100)
      const result2 = store.hit('key1', 60000, 100)
      expect(result1).toBe(result2)
    })

    it('result values are correct when consumed immediately', () => {
      const r1 = store.hit('key1', 60000, 100)
      const count1 = r1.count
      expect(count1).toBe(1)

      store.hit('key1', 60000, 100)
      expect(r1.count).toBe(2)

      const r2 = store.hit('key2', 60000, 100)
      expect(r2.count).toBe(1)
      expect(r1.count).toBe(1) // r1 === r2, now shows key2's data
    })

    it('subsequent hit overwrites previous result reference', () => {
      const result = store.hit('key1', 60000, 100)
      expect(result.count).toBe(1)

      store.hit('key2', 60000, 100)
      // result now points to key2's data
      expect(result.count).toBe(1)

      store.hit('key1', 60000, 100)
      // result now points to key1's updated data
      expect(result.count).toBe(2)
    })
  })

  describe('sweep timer and inline expiry', () => {
    it('handles expired entry on access before sweep runs', async () => {
      store.hit('key1', 50, 100)
      expect(store.hit('key1', 50, 100).count).toBe(2)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Entry expired between sweeps — inline check resets it
      expect(store.hit('key1', 50, 100).count).toBe(1)
    })

    it('expired entry gets fresh resetAt', async () => {
      store.hit('key1', 50, 100)

      await new Promise(resolve => setTimeout(resolve, 100))

      const before = Date.now()
      const result = store.hit('key1', 60000, 100)
      expect(result.count).toBe(1)
      expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000)
    })
  })

  describe('memory bounded', () => {
    it('100K unique keys do not leak after expiry and re-access', async () => {
      const window = 50
      for (let i = 0; i < 100_000; i++) {
        store.hit(`ip-${i}`, window, 100)
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      // Re-access a subset — they should all reset to count 1
      for (let i = 0; i < 100; i++) {
        expect(store.hit(`ip-${i}`, window, 100).count).toBe(1)
      }
    })
  })
})
