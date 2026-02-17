import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'

interface Entry {
  count: number
  resetAt: number
}

interface BanEntry {
  expiresAt: number
}

interface ViolationEntry {
  count: number
  resetAt: number
}

class MemoryStore implements HitLimitStore {
  isSync = true as const
  private readonly hits: Map<string, Entry> = new Map()
  private readonly bans: Map<string, BanEntry> = new Map()
  private readonly violations: Map<string, ViolationEntry> = new Map()
  private readonly _result: StoreResult = { count: 0, resetAt: 0 }
  private readonly sweepInterval: ReturnType<typeof setInterval>

  constructor() {
    this.sweepInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.hits) {
        if (now >= entry.resetAt) this.hits.delete(key)
      }
      for (const [key, ban] of this.bans) {
        if (now >= ban.expiresAt) this.bans.delete(key)
      }
      for (const [key, violation] of this.violations) {
        if (now >= violation.resetAt) this.violations.delete(key)
      }
    }, 10_000)
    if (typeof this.sweepInterval.unref === 'function') {
      this.sweepInterval.unref()
    }
  }

  hit(key: string, windowMs: number, _limit: number): StoreResult {
    const entry = this.hits.get(key)

    if (entry !== undefined) {
      const now = Date.now()
      if (now >= entry.resetAt) {
        entry.count = 1
        entry.resetAt = now + windowMs
      } else {
        entry.count++
      }
      this._result.count = entry.count
      this._result.resetAt = entry.resetAt
      return this._result
    }

    const now = Date.now()
    const resetAt = now + windowMs
    this.hits.set(key, { count: 1, resetAt })
    this._result.count = 1
    this._result.resetAt = resetAt
    return this._result
  }

  isBanned(key: string): boolean {
    const ban = this.bans.get(key)
    if (!ban) return false
    if (Date.now() >= ban.expiresAt) {
      this.bans.delete(key)
      return false
    }
    return true
  }

  ban(key: string, durationMs: number): void {
    const expiresAt = Date.now() + durationMs
    this.bans.set(key, { expiresAt })
  }

  recordViolation(key: string, windowMs: number): number {
    const entry = this.violations.get(key)
    if (entry && Date.now() < entry.resetAt) {
      entry.count++
      return entry.count
    }

    const resetAt = Date.now() + windowMs
    this.violations.set(key, { count: 1, resetAt })
    return 1
  }

  reset(key: string): void {
    this.hits.delete(key)
    this.bans.delete(key)
    this.violations.delete(key)
  }

  shutdown(): void {
    clearInterval(this.sweepInterval)
    this.hits.clear()
    this.bans.clear()
    this.violations.clear()
  }
}

export function memoryStore(): HitLimitStore {
  return new MemoryStore()
}
