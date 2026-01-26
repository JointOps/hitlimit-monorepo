import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { memoryStore } from '../../src/stores/memory'
import { sqliteStore } from '../../src/stores/sqlite'
import type { HitLimitStore } from '@joint-ops/hitlimit-types'

describe('Concurrent Access', () => {
  describe('Memory Store', () => {
    let store: HitLimitStore

    beforeEach(() => {
      store = memoryStore()
    })

    afterEach(async () => {
      await store.shutdown?.()
    })

    it('handles 100 concurrent hits on same key', async () => {
      const key = 'concurrent-test'
      const windowMs = 60000
      const limit = 1000

      const promises = Array.from({ length: 100 }, () =>
        store.hit(key, windowMs, limit)
      )

      const results = await Promise.all(promises)

      const counts = results.map(r => r.count).sort((a, b) => a - b)
      expect(counts[0]).toBe(1)
      expect(counts[99]).toBe(100)

      const uniqueCounts = new Set(counts)
      expect(uniqueCounts.size).toBe(100)
    })

    it('handles concurrent hits on different keys', async () => {
      const windowMs = 60000
      const limit = 100

      const promises = Array.from({ length: 50 }, (_, i) =>
        store.hit(`key-${i}`, windowMs, limit)
      )

      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result.count).toBe(1)
      })
    })

    it('handles mixed concurrent hits and resets', async () => {
      const key = 'mixed-test'
      const windowMs = 60000
      const limit = 100

      for (let i = 0; i < 10; i++) {
        await store.hit(key, windowMs, limit)
      }

      const hitPromises = Array.from({ length: 20 }, () =>
        store.hit(key, windowMs, limit)
      )
      const resetPromise = store.reset(key)

      await Promise.all([...hitPromises, resetPromise])

      const finalResult = await store.hit(key, windowMs, limit)
      expect(finalResult.count).toBeGreaterThanOrEqual(1)
    })

    it('maintains correct counts under load', async () => {
      const key = 'load-test'
      const windowMs = 60000
      const limit = 10000

      const promises = Array.from({ length: 500 }, () =>
        store.hit(key, windowMs, limit)
      )

      const results = await Promise.all(promises)

      const maxCount = Math.max(...results.map(r => r.count))
      expect(maxCount).toBe(500)
    })
  })

  describe('SQLite Store', () => {
    let store: HitLimitStore

    beforeEach(() => {
      store = sqliteStore({ path: ':memory:' })
    })

    afterEach(async () => {
      await store.shutdown?.()
    })

    it('handles 100 concurrent hits on same key atomically', async () => {
      const key = 'concurrent-sqlite'
      const windowMs = 60000
      const limit = 1000

      const promises = Array.from({ length: 100 }, () =>
        store.hit(key, windowMs, limit)
      )

      const results = await Promise.all(promises)

      const counts = results.map(r => r.count).sort((a, b) => a - b)
      expect(counts[0]).toBe(1)
      expect(counts[99]).toBe(100)
    })

    it('handles high concurrent load', async () => {
      const windowMs = 60000
      const limit = 10000

      const promises = Array.from({ length: 500 }, (_, i) =>
        store.hit(`load-key-${i % 10}`, windowMs, limit)
      )

      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result.count).toBeGreaterThanOrEqual(1)
        expect(result.resetAt).toBeGreaterThan(Date.now())
      })
    })

    it('handles rapid sequential hits', async () => {
      const key = 'rapid-test'
      const windowMs = 60000
      const limit = 1000

      for (let i = 0; i < 100; i++) {
        const result = await store.hit(key, windowMs, limit)
        expect(result.count).toBe(i + 1)
      }
    })

    it('handles multiple keys concurrently', async () => {
      const windowMs = 60000
      const limit = 100
      const keyCount = 20
      const hitsPerKey = 10

      const promises: Promise<any>[] = []
      for (let k = 0; k < keyCount; k++) {
        for (let h = 0; h < hitsPerKey; h++) {
          promises.push(store.hit(`key-${k}`, windowMs, limit))
        }
      }

      const results = await Promise.all(promises)
      expect(results.length).toBe(keyCount * hitsPerKey)
    })
  })
})
