import type { HitLimitStore, HitWithBanResult, StoreResult } from '@joint-ops/hitlimit-types'

export interface PostgresStoreOptions {
  pool: any  // pg.Pool — typed as any to avoid requiring pg at compile time
  tablePrefix?: string
  cleanupInterval?: number
  skipTableCreation?: boolean
}

class PostgresStore implements HitLimitStore {
  private pool: any
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private tablesReady: Promise<void> | null = null
  private ready: boolean

  // Pre-built query strings (constructed once, reused every call)
  private readonly hitQ: { name: string; text: string }
  private readonly banCheckQ: { name: string; text: string }
  private readonly hitUpsertQ: { name: string; text: string }
  private readonly violationQ: { name: string; text: string }
  private readonly banSetQ: { name: string; text: string }
  private readonly isBannedQ: { name: string; text: string }
  private readonly banQ: { name: string; text: string }
  private readonly recordViolationQ: { name: string; text: string }
  private readonly resetHitsQ: string
  private readonly resetBansQ: string
  private readonly resetViolationsQ: string
  private readonly cleanupHitsQ: string
  private readonly cleanupBansQ: string
  private readonly cleanupViolationsQ: string

  constructor(options: PostgresStoreOptions) {
    this.pool = options.pool
    const t = options.tablePrefix ?? 'hitlimit'
    const skipTableCreation = options.skipTableCreation ?? false

    // Phase A1: Eager table creation, boolean ready flag
    if (skipTableCreation) {
      this.ready = true
    } else {
      this.ready = false
      this.tablesReady = this.createTables(t).then(() => { this.ready = true })
    }

    // Phase A2: Pre-build all query strings + Phase B: named prepared statements
    this.hitQ = {
      name: `hl_hit_${t}`,
      text: `INSERT INTO ${t}_hits (key, count, reset_at) VALUES ($1, 1, $2) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN ${t}_hits.reset_at <= $3 THEN 1 ELSE ${t}_hits.count + 1 END, reset_at = CASE WHEN ${t}_hits.reset_at <= $3 THEN $2 ELSE ${t}_hits.reset_at END RETURNING count, reset_at`
    }

    this.banCheckQ = {
      name: `hl_banchk_${t}`,
      text: `SELECT expires_at FROM ${t}_bans WHERE key = $1 AND expires_at > $2`
    }

    // hitUpsertQ is identical to hitQ (reused in hitWithBan — same SQL, same name)
    this.hitUpsertQ = this.hitQ

    this.violationQ = {
      name: `hl_viol_${t}`,
      text: `INSERT INTO ${t}_violations (key, count, reset_at) VALUES ($1, 1, $2) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN ${t}_violations.reset_at <= $3 THEN 1 ELSE ${t}_violations.count + 1 END, reset_at = CASE WHEN ${t}_violations.reset_at <= $3 THEN $2 ELSE ${t}_violations.reset_at END RETURNING count`
    }

    this.banSetQ = {
      name: `hl_banset_${t}`,
      text: `INSERT INTO ${t}_bans (key, expires_at) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET expires_at = $2`
    }

    this.isBannedQ = {
      name: `hl_isbanned_${t}`,
      text: `SELECT 1 FROM ${t}_bans WHERE key = $1 AND expires_at > $2`
    }

    this.banQ = this.banSetQ

    this.recordViolationQ = this.violationQ

    // Non-hot-path queries (reset, cleanup) — no prepared statement needed
    this.resetHitsQ = `DELETE FROM ${t}_hits WHERE key = $1`
    this.resetBansQ = `DELETE FROM ${t}_bans WHERE key = $1`
    this.resetViolationsQ = `DELETE FROM ${t}_violations WHERE key = $1`
    this.cleanupHitsQ = `DELETE FROM ${t}_hits WHERE reset_at <= $1`
    this.cleanupBansQ = `DELETE FROM ${t}_bans WHERE expires_at <= $1`
    this.cleanupViolationsQ = `DELETE FROM ${t}_violations WHERE reset_at <= $1`

    const interval = options.cleanupInterval ?? 60_000
    this.cleanupTimer = setInterval(() => this.cleanup(), interval)
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  private async createTables(t: string): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${t}_hits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${t}_bans (
        key TEXT PRIMARY KEY,
        expires_at BIGINT NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${t}_violations (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      )
    `)
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()
    const result = await this.pool.query({
      name: this.hitQ.name,
      text: this.hitQ.text,
      values: [key, now + windowMs, now]
    })
    return {
      count: result.rows[0].count,
      resetAt: Number(result.rows[0].reset_at)
    }
  }

  async hitWithBan(key: string, windowMs: number, limit: number, banThreshold: number, banDurationMs: number): Promise<HitWithBanResult> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()
    const resetAt = now + windowMs
    const banExpiresAt = now + banDurationMs

    // Check ban first
    const banResult = await this.pool.query({
      name: this.banCheckQ.name,
      text: this.banCheckQ.text,
      values: [key, now]
    })
    if (banResult.rowCount > 0) {
      return {
        count: 0,
        resetAt,
        banned: true,
        violations: 0,
        banExpiresAt: Number(banResult.rows[0].expires_at)
      }
    }

    // Atomic hit
    const hitResult = await this.pool.query({
      name: this.hitUpsertQ.name,
      text: this.hitUpsertQ.text,
      values: [key, resetAt, now]
    })

    const hitCount = hitResult.rows[0].count
    const hitResetAt = Number(hitResult.rows[0].reset_at)

    // Track violations if over limit
    if (hitCount > limit) {
      const violationResult = await this.pool.query({
        name: this.violationQ.name,
        text: this.violationQ.text,
        values: [key, banExpiresAt, now]
      })

      const violations = violationResult.rows[0].count
      const shouldBan = violations >= banThreshold

      if (shouldBan) {
        await this.pool.query({
          name: this.banSetQ.name,
          text: this.banSetQ.text,
          values: [key, banExpiresAt]
        })
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
    if (!this.ready) await this.tablesReady
    const result = await this.pool.query({
      name: this.isBannedQ.name,
      text: this.isBannedQ.text,
      values: [key, Date.now()]
    })
    return result.rowCount > 0
  }

  async ban(key: string, durationMs: number): Promise<void> {
    if (!this.ready) await this.tablesReady
    await this.pool.query({
      name: this.banQ.name,
      text: this.banQ.text,
      values: [key, Date.now() + durationMs]
    })
  }

  async recordViolation(key: string, windowMs: number): Promise<number> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()
    const result = await this.pool.query({
      name: this.recordViolationQ.name,
      text: this.recordViolationQ.text,
      values: [key, now + windowMs, now]
    })
    return result.rows[0].count
  }

  async reset(key: string): Promise<void> {
    if (!this.ready) await this.tablesReady
    await this.pool.query(this.resetHitsQ, [key])
    await this.pool.query(this.resetBansQ, [key])
    await this.pool.query(this.resetViolationsQ, [key])
  }

  private async cleanup(): Promise<void> {
    try {
      const now = Date.now()
      await this.pool.query(this.cleanupHitsQ, [now])
      await this.pool.query(this.cleanupBansQ, [now])
      await this.pool.query(this.cleanupViolationsQ, [now])
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
