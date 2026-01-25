import type { HitLimitStore, StoreResult } from '@hitlimit/types'

interface Entry {
  count: number
  resetAt: number
}

class MemoryStore implements HitLimitStore {
  private hits = new Map<string, Entry>()
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), 60000)
  }

  hit(key: string, windowMs: number, _limit: number): StoreResult {
    const now = Date.now()
    const entry = this.hits.get(key)

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs
      this.hits.set(key, { count: 1, resetAt })
      return { count: 1, resetAt }
    }

    entry.count++
    return { count: entry.count, resetAt: entry.resetAt }
  }

  reset(key: string): void {
    this.hits.delete(key)
  }

  shutdown(): void {
    clearInterval(this.cleanupTimer)
    this.hits.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) {
        this.hits.delete(key)
      }
    }
  }
}

export function memoryStore(): HitLimitStore {
  return new MemoryStore()
}
