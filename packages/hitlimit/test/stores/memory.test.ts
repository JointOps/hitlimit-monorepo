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
})
