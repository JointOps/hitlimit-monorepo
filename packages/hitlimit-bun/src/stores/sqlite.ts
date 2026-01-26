import { Database } from 'bun:sqlite'
import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'

export interface SqliteStoreOptions {
  path?: string
}

class BunSqliteStore implements HitLimitStore {
  private db: Database
  private hitStmt: ReturnType<Database['prepare']>
  private getStmt: ReturnType<Database['prepare']>
  private resetStmt: ReturnType<Database['prepare']>
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor(options: SqliteStoreOptions = {}) {
    this.db = new Database(options.path ?? ':memory:')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hitlimit (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_at INTEGER NOT NULL
      )
    `)

    this.hitStmt = this.db.prepare(`
      INSERT INTO hitlimit (key, count, reset_at) VALUES (?1, 1, ?2)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN reset_at <= ?3 THEN 1 ELSE count + 1 END,
        reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END
    `)

    this.getStmt = this.db.prepare('SELECT count, reset_at FROM hitlimit WHERE key = ?')
    this.resetStmt = this.db.prepare('DELETE FROM hitlimit WHERE key = ?')

    this.cleanupTimer = setInterval(() => {
      this.db.prepare('DELETE FROM hitlimit WHERE reset_at <= ?').run(Date.now())
    }, 60000)
  }

  hit(key: string, windowMs: number, _limit: number): StoreResult {
    const now = Date.now()
    const resetAt = now + windowMs

    this.hitStmt.run(key, resetAt, now)
    const row = this.getStmt.get(key) as { count: number; reset_at: number }

    return { count: row.count, resetAt: row.reset_at }
  }

  reset(key: string): void {
    this.resetStmt.run(key)
  }

  shutdown(): void {
    clearInterval(this.cleanupTimer)
    this.db.close()
  }
}

export function sqliteStore(options?: SqliteStoreOptions): HitLimitStore {
  return new BunSqliteStore(options)
}
