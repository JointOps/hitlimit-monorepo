import type { HitLimitStore, StoreResult } from '@joint-ops/hitlimit-types'
import Database from 'better-sqlite3'

export interface SqliteStoreOptions {
  path?: string
}

class SqliteStore implements HitLimitStore {
  private db: Database.Database
  private hitStmt: Database.Statement
  private getStmt: Database.Statement
  private resetStmt: Database.Statement
  private isBannedStmt: Database.Statement
  private banStmt: Database.Statement
  private recordViolationStmt: Database.Statement
  private getViolationStmt: Database.Statement
  private resetBanStmt: Database.Statement
  private resetViolationStmt: Database.Statement
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor(options: SqliteStoreOptions = {}) {
    this.db = new Database(options.path ?? ':memory:')
    this.db.pragma('journal_mode = WAL')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hitlimit (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_at INTEGER NOT NULL
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hitlimit_bans (
        key TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hitlimit_violations (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at INTEGER NOT NULL
      )
    `)

    this.hitStmt = this.db.prepare(`
      INSERT INTO hitlimit (key, count, reset_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
        reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
    `)

    this.getStmt = this.db.prepare('SELECT count, reset_at FROM hitlimit WHERE key = ?')
    this.resetStmt = this.db.prepare('DELETE FROM hitlimit WHERE key = ?')

    this.isBannedStmt = this.db.prepare('SELECT 1 FROM hitlimit_bans WHERE key = ? AND expires_at > ?')
    this.banStmt = this.db.prepare('INSERT OR REPLACE INTO hitlimit_bans (key, expires_at) VALUES (?, ?)')

    this.recordViolationStmt = this.db.prepare(`
      INSERT INTO hitlimit_violations (key, count, reset_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
        reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
    `)
    this.getViolationStmt = this.db.prepare('SELECT count FROM hitlimit_violations WHERE key = ?')

    this.resetBanStmt = this.db.prepare('DELETE FROM hitlimit_bans WHERE key = ?')
    this.resetViolationStmt = this.db.prepare('DELETE FROM hitlimit_violations WHERE key = ?')

    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      this.db.prepare('DELETE FROM hitlimit WHERE reset_at <= ?').run(now)
      this.db.prepare('DELETE FROM hitlimit_bans WHERE expires_at <= ?').run(now)
      this.db.prepare('DELETE FROM hitlimit_violations WHERE reset_at <= ?').run(now)
    }, 60000)
  }

  hit(key: string, windowMs: number, _limit: number): StoreResult {
    const now = Date.now()
    const resetAt = now + windowMs

    this.hitStmt.run(key, resetAt, now, now)
    const row = this.getStmt.get(key) as { count: number; reset_at: number }

    return { count: row.count, resetAt: row.reset_at }
  }

  isBanned(key: string): boolean {
    return this.isBannedStmt.get(key, Date.now()) !== undefined
  }

  ban(key: string, durationMs: number): void {
    this.banStmt.run(key, Date.now() + durationMs)
  }

  recordViolation(key: string, windowMs: number): number {
    const now = Date.now()
    const resetAt = now + windowMs
    this.recordViolationStmt.run(key, resetAt, now, now)
    const row = this.getViolationStmt.get(key) as { count: number } | undefined
    return row?.count ?? 1
  }

  reset(key: string): void {
    this.resetStmt.run(key)
    this.resetBanStmt.run(key)
    this.resetViolationStmt.run(key)
  }

  shutdown(): void {
    clearInterval(this.cleanupTimer)
    this.db.close()
  }
}

export function sqliteStore(options?: SqliteStoreOptions): HitLimitStore {
  return new SqliteStore(options)
}
