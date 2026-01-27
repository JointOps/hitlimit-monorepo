import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'

/**
 * Ultra-optimized in-memory store using setTimeout for cleanup
 *
 * Strategy: Use setTimeout per key like rate-limiter-flexible
 * - No expiration check on every hit (setTimeout handles cleanup)
 * - If key exists in map, it's guaranteed to be valid
 * - Trade-off: More setTimeout handles, but faster hot path
 */

interface Entry {
  count: number
  resetAt: number
  timeoutId: ReturnType<typeof setTimeout>
}

class MemoryStore implements HitLimitStore {
  private readonly hits: Map<string, Entry> = new Map()

  hit(key: string, windowMs: number, _limit: number): StoreResult {
    const entry = this.hits.get(key)

    if (entry !== undefined) {
      // Entry exists and is guaranteed valid (setTimeout hasn't fired yet)
      // Hot path: just increment, no expiration check needed!
      entry.count++
      return { count: entry.count, resetAt: entry.resetAt }
    }

    // New key - create entry with cleanup timeout
    const now = Date.now()
    const resetAt = now + windowMs

    const timeoutId = setTimeout(() => {
      this.hits.delete(key)
    }, windowMs)

    // Don't keep process alive
    if (typeof timeoutId.unref === 'function') {
      timeoutId.unref()
    }

    this.hits.set(key, { count: 1, resetAt, timeoutId })
    return { count: 1, resetAt }
  }

  reset(key: string): void {
    const entry = this.hits.get(key)
    if (entry) {
      clearTimeout(entry.timeoutId)
      this.hits.delete(key)
    }
  }

  shutdown(): void {
    for (const [, entry] of this.hits) {
      clearTimeout(entry.timeoutId)
    }
    this.hits.clear()
  }
}

export function memoryStore(): HitLimitStore {
  return new MemoryStore()
}
