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

interface BanEntry {
  expiresAt: number
  timeoutId: ReturnType<typeof setTimeout>
}

interface ViolationEntry {
  count: number
  resetAt: number
  timeoutId: ReturnType<typeof setTimeout>
}

class MemoryStore implements HitLimitStore {
  private readonly hits: Map<string, Entry> = new Map()
  private readonly bans: Map<string, BanEntry> = new Map()
  private readonly violations: Map<string, ViolationEntry> = new Map()

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

  isBanned(key: string): boolean {
    const ban = this.bans.get(key)
    if (!ban) return false
    if (Date.now() >= ban.expiresAt) {
      clearTimeout(ban.timeoutId)
      this.bans.delete(key)
      return false
    }
    return true
  }

  ban(key: string, durationMs: number): void {
    const existing = this.bans.get(key)
    if (existing) clearTimeout(existing.timeoutId)

    const expiresAt = Date.now() + durationMs
    const timeoutId = setTimeout(() => {
      this.bans.delete(key)
    }, durationMs)

    if (typeof timeoutId.unref === 'function') {
      timeoutId.unref()
    }

    this.bans.set(key, { expiresAt, timeoutId })
  }

  recordViolation(key: string, windowMs: number): number {
    const entry = this.violations.get(key)
    if (entry && Date.now() < entry.resetAt) {
      entry.count++
      return entry.count
    }

    // New or expired violation window
    if (entry) clearTimeout(entry.timeoutId)

    const resetAt = Date.now() + windowMs
    const timeoutId = setTimeout(() => {
      this.violations.delete(key)
    }, windowMs)

    if (typeof timeoutId.unref === 'function') {
      timeoutId.unref()
    }

    this.violations.set(key, { count: 1, resetAt, timeoutId })
    return 1
  }

  reset(key: string): void {
    const entry = this.hits.get(key)
    if (entry) {
      clearTimeout(entry.timeoutId)
      this.hits.delete(key)
    }
    const ban = this.bans.get(key)
    if (ban) {
      clearTimeout(ban.timeoutId)
      this.bans.delete(key)
    }
    const violation = this.violations.get(key)
    if (violation) {
      clearTimeout(violation.timeoutId)
      this.violations.delete(key)
    }
  }

  shutdown(): void {
    for (const [, entry] of this.hits) {
      clearTimeout(entry.timeoutId)
    }
    this.hits.clear()
    for (const [, entry] of this.bans) {
      clearTimeout(entry.timeoutId)
    }
    this.bans.clear()
    for (const [, entry] of this.violations) {
      clearTimeout(entry.timeoutId)
    }
    this.violations.clear()
  }
}

export function memoryStore(): HitLimitStore {
  return new MemoryStore()
}
