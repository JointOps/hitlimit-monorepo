import type { HitLimitStore, HitWithBanResult, StoreResult } from '@joint-ops/hitlimit-types'

export interface PostgresStoreOptions {
  pool: any  // pg.Pool — typed as any to avoid requiring pg at compile time
  tablePrefix?: string
  cleanupInterval?: number
  skipTableCreation?: boolean
}

class PostgresStore implements HitLimitStore {
  private pool: any
  private tablePrefix: string
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private tablesReady: Promise<void> | null = null
  private skipTableCreation: boolean

  constructor(options: PostgresStoreOptions) {
    this.pool = options.pool
    this.tablePrefix = options.tablePrefix ?? 'hitlimit'
    this.skipTableCreation = options.skipTableCreation ?? false

    const interval = options.cleanupInterval ?? 60_000
    this.cleanupTimer = setInterval(() => this.cleanup(), interval)
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  private ensureTables(): Promise<void> {
    if (this.skipTableCreation) return Promise.resolve()
    if (!this.tablesReady) {
      this.tablesReady = this.createTables()
    }
    return this.tablesReady
  }

  private async createTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_hits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_bans (
        key TEXT PRIMARY KEY,
        expires_at BIGINT NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}_violations (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      )
    `)
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    await this.ensureTables()
    const now = Date.now()
    const resetAt = now + windowMs

    const result = await this.pool.query(`
      INSERT INTO ${this.tablePrefix}_hits (key, count, reset_at)
      VALUES ($1, 1, $2)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN ${this.tablePrefix}_hits.reset_at <= $3 THEN 1
          ELSE ${this.tablePrefix}_hits.count + 1
        END,
        reset_at = CASE
          WHEN ${this.tablePrefix}_hits.reset_at <= $3 THEN $2
          ELSE ${this.tablePrefix}_hits.reset_at
        END
      RETURNING count, reset_at
    `, [key, resetAt, now])

    return {
      count: result.rows[0].count,
      resetAt: Number(result.rows[0].reset_at)
    }
  }

  async hitWithBan(key: string, windowMs: number, limit: number, banThreshold: number, banDurationMs: number): Promise<HitWithBanResult> {
    await this.ensureTables()
    const now = Date.now()
    const resetAt = now + windowMs
    const banExpiresAt = now + banDurationMs

    // Check ban first
    const banResult = await this.pool.query(
      `SELECT expires_at FROM ${this.tablePrefix}_bans WHERE key = $1 AND expires_at > $2`,
      [key, now]
    )
    if (banResult.rowCount > 0) {
      return {
        count: 0,
        resetAt: now + windowMs,
        banned: true,
        violations: 0,
        banExpiresAt: Number(banResult.rows[0].expires_at)
      }
    }

    // Atomic hit
    const hitResult = await this.pool.query(`
      INSERT INTO ${this.tablePrefix}_hits (key, count, reset_at)
      VALUES ($1, 1, $2)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN ${this.tablePrefix}_hits.reset_at <= $3 THEN 1
          ELSE ${this.tablePrefix}_hits.count + 1
        END,
        reset_at = CASE
          WHEN ${this.tablePrefix}_hits.reset_at <= $3 THEN $2
          ELSE ${this.tablePrefix}_hits.reset_at
        END
      RETURNING count, reset_at
    `, [key, resetAt, now])

    const hitCount = hitResult.rows[0].count
    const hitResetAt = Number(hitResult.rows[0].reset_at)

    // Track violations if over limit
    if (hitCount > limit) {
      const violationResult = await this.pool.query(`
        INSERT INTO ${this.tablePrefix}_violations (key, count, reset_at)
        VALUES ($1, 1, $2)
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN ${this.tablePrefix}_violations.reset_at <= $3 THEN 1
            ELSE ${this.tablePrefix}_violations.count + 1
          END,
          reset_at = CASE
            WHEN ${this.tablePrefix}_violations.reset_at <= $3 THEN $2
            ELSE ${this.tablePrefix}_violations.reset_at
          END
        RETURNING count
      `, [key, banExpiresAt, now])

      const violations = violationResult.rows[0].count
      const shouldBan = violations >= banThreshold

      if (shouldBan) {
        await this.pool.query(`
          INSERT INTO ${this.tablePrefix}_bans (key, expires_at)
          VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET expires_at = $2
        `, [key, banExpiresAt])
      }

      return {
        count: hitCount,
        resetAt: hitResetAt,
        banned: shouldBan,
        violations,
        banExpiresAt: shouldBan ? banExpiresAt : 0
      }
    }

    return {
      count: hitCount,
      resetAt: hitResetAt,
      banned: false,
      violations: 0,
      banExpiresAt: 0
    }
  }

  async isBanned(key: string): Promise<boolean> {
    await this.ensureTables()
    const result = await this.pool.query(
      `SELECT 1 FROM ${this.tablePrefix}_bans WHERE key = $1 AND expires_at > $2`,
      [key, Date.now()]
    )
    return result.rowCount > 0
  }

  async ban(key: string, durationMs: number): Promise<void> {
    await this.ensureTables()
    const expiresAt = Date.now() + durationMs
    await this.pool.query(`
      INSERT INTO ${this.tablePrefix}_bans (key, expires_at)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET expires_at = $2
    `, [key, expiresAt])
  }

  async recordViolation(key: string, windowMs: number): Promise<number> {
    await this.ensureTables()
    const now = Date.now()
    const resetAt = now + windowMs
    const result = await this.pool.query(`
      INSERT INTO ${this.tablePrefix}_violations (key, count, reset_at)
      VALUES ($1, 1, $2)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN ${this.tablePrefix}_violations.reset_at <= $3 THEN 1
          ELSE ${this.tablePrefix}_violations.count + 1
        END,
        reset_at = CASE
          WHEN ${this.tablePrefix}_violations.reset_at <= $3 THEN $2
          ELSE ${this.tablePrefix}_violations.reset_at
        END
      RETURNING count
    `, [key, resetAt, now])
    return result.rows[0].count
  }

  async reset(key: string): Promise<void> {
    await this.ensureTables()
    await this.pool.query(`DELETE FROM ${this.tablePrefix}_hits WHERE key = $1`, [key])
    await this.pool.query(`DELETE FROM ${this.tablePrefix}_bans WHERE key = $1`, [key])
    await this.pool.query(`DELETE FROM ${this.tablePrefix}_violations WHERE key = $1`, [key])
  }

  private async cleanup(): Promise<void> {
    try {
      const now = Date.now()
      await this.pool.query(`DELETE FROM ${this.tablePrefix}_hits WHERE reset_at <= $1`, [now])
      await this.pool.query(`DELETE FROM ${this.tablePrefix}_bans WHERE expires_at <= $1`, [now])
      await this.pool.query(`DELETE FROM ${this.tablePrefix}_violations WHERE reset_at <= $1`, [now])
    } catch { /* Cleanup failures are non-fatal */ }
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

export function postgresStore(options: PostgresStoreOptions): HitLimitStore {
  return new PostgresStore(options)
}
