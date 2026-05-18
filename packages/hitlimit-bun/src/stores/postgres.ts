import type { HitLimitStore, HitWithBanResult, StoreResult } from '@joint-ops/hitlimit-types'
import { SQL } from 'bun'

const VALID_PREFIX = /^[A-Za-z_][A-Za-z0-9_]*$/

type PgPoolLike = {
  query(query: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>
  query(query: { name?: string; text: string; values?: any[] }): Promise<{ rows: any[]; rowCount?: number | null }>
}

type DriverMode = 'bun' | 'pg'

export interface PostgresStoreOptions {
  /** Connection string. Store creates and owns a Bun native SQL client. */
  url?: string
  /** Caller-owned Bun native SQL client. Store uses it but does not close it. */
  client?: SQL
  /**
   * @deprecated Use `url` or `client` in @joint-ops/hitlimit-bun.
   * Legacy pg.Pool support. Store uses it but does not close it.
   */
  pool?: PgPoolLike
  tablePrefix?: string
  cleanupInterval?: number
  skipTableCreation?: boolean
}

class PostgresStore implements HitLimitStore {
  private mode: DriverMode
  private client: SQL | null
  private pool: PgPoolLike | null
  private ownsClient: boolean
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private tablesReady: Promise<void> | null = null
  private ready: boolean

  // Pre-built query text strings (constructed once at init, reused every call)
  private readonly hitQText: string
  private readonly banCheckQText: string
  private readonly violationQText: string
  private readonly banSetQText: string
  private readonly isBannedQText: string
  private readonly resetHitsQ: string
  private readonly resetBansQ: string
  private readonly resetViolationsQ: string
  private readonly cleanupHitsQ: string
  private readonly cleanupBansQ: string
  private readonly cleanupViolationsQ: string

  // Named prepared statement objects (pg mode only — pg driver caches these server-side by name)
  private readonly hitQ: { name: string; text: string }
  private readonly banCheckQ: { name: string; text: string }
  private readonly violationQ: { name: string; text: string }
  private readonly banSetQ: { name: string; text: string }
  private readonly isBannedQ: { name: string; text: string }

  constructor(options: PostgresStoreOptions) {
    const { url, client, pool } = options

    // Validate: exactly one connection source required
    const provided = [url, client, pool].filter(v => v !== undefined)
    if (provided.length === 0) {
      throw new Error('postgresStore requires exactly one of url, client, or pool')
    }
    if (provided.length > 1) {
      throw new Error('postgresStore accepts only one of url, client, or pool')
    }

    // Validate tablePrefix before any SQL interpolation
    const t = options.tablePrefix ?? 'hitlimit'
    if (!VALID_PREFIX.test(t)) {
      throw new Error(`Invalid tablePrefix: ${t}`)
    }

    // url: create and own a Bun native SQL client.
    // client: use a caller-owned Bun native SQL client.
    // pool: legacy pg.Pool path kept for backwards compatibility.
    if (url !== undefined) {
      this.mode = 'bun'
      this.client = new SQL(url)
      this.pool = null
      this.ownsClient = true
    } else if (client !== undefined) {
      this.mode = 'bun'
      this.client = client
      this.pool = null
      this.ownsClient = false
    } else {
      this.mode = 'pg'
      this.client = null
      this.pool = pool!
      this.ownsClient = false
    }

    // Table creation (deferred — resolved before first query)
    if (options.skipTableCreation) {
      this.ready = true
    } else {
      this.ready = false
      this.tablesReady = this.createTables(t).then(() => { this.ready = true })
    }

    // Pre-build all query text strings.
    // tablePrefix is validated above — safe to interpolate into SQL string literals.
    // User-supplied values (key, timestamps) are never in these strings; they go in the values array.
    this.hitQText = `INSERT INTO ${t}_hits (key, count, reset_at) VALUES ($1, 1, $2) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN ${t}_hits.reset_at <= $3 THEN 1 ELSE ${t}_hits.count + 1 END, reset_at = CASE WHEN ${t}_hits.reset_at <= $3 THEN $2 ELSE ${t}_hits.reset_at END RETURNING count, reset_at`
    this.banCheckQText = `SELECT expires_at FROM ${t}_bans WHERE key = $1 AND expires_at > $2`
    this.violationQText = `INSERT INTO ${t}_violations (key, count, reset_at) VALUES ($1, 1, $2) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN ${t}_violations.reset_at <= $3 THEN 1 ELSE ${t}_violations.count + 1 END, reset_at = CASE WHEN ${t}_violations.reset_at <= $3 THEN $2 ELSE ${t}_violations.reset_at END RETURNING count`
    this.banSetQText = `INSERT INTO ${t}_bans (key, expires_at) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET expires_at = $2`
    this.isBannedQText = `SELECT 1 FROM ${t}_bans WHERE key = $1 AND expires_at > $2`
    this.resetHitsQ = `DELETE FROM ${t}_hits WHERE key = $1`
    this.resetBansQ = `DELETE FROM ${t}_bans WHERE key = $1`
    this.resetViolationsQ = `DELETE FROM ${t}_violations WHERE key = $1`
    this.cleanupHitsQ = `DELETE FROM ${t}_hits WHERE reset_at <= $1`
    this.cleanupBansQ = `DELETE FROM ${t}_bans WHERE expires_at <= $1`
    this.cleanupViolationsQ = `DELETE FROM ${t}_violations WHERE reset_at <= $1`

    // Named prepared statement descriptors (pg mode only — same text strings, with a cache name)
    this.hitQ = { name: `hl_hit_${t}`, text: this.hitQText }
    this.banCheckQ = { name: `hl_banchk_${t}`, text: this.banCheckQText }
    this.violationQ = { name: `hl_viol_${t}`, text: this.violationQText }
    this.banSetQ = { name: `hl_banset_${t}`, text: this.banSetQText }
    this.isBannedQ = { name: `hl_isbanned_${t}`, text: this.isBannedQText }

    const interval = options.cleanupInterval ?? 60_000
    this.cleanupTimer = setInterval(() => this.cleanup(), interval)
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  private async createTables(t: string): Promise<void> {
    const hitsDDL = `CREATE TABLE IF NOT EXISTS ${t}_hits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 1, reset_at BIGINT NOT NULL)`
    const bansDDL = `CREATE TABLE IF NOT EXISTS ${t}_bans (key TEXT PRIMARY KEY, expires_at BIGINT NOT NULL)`
    const violsDDL = `CREATE TABLE IF NOT EXISTS ${t}_violations (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 1, reset_at BIGINT NOT NULL)`

    if (this.mode === 'bun') {
      await this.client!.unsafe(hitsDDL)
      await this.client!.unsafe(bansDDL)
      await this.client!.unsafe(violsDDL)
    } else {
      await this.pool!.query(hitsDDL)
      await this.pool!.query(bansDDL)
      await this.pool!.query(violsDDL)
    }
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()
    const resetAt = now + windowMs

    if (this.mode === 'bun') {
      const rows = await this.client!.unsafe(this.hitQText, [key, resetAt, now])
      return { count: Number(rows[0].count), resetAt: Number(rows[0].reset_at) }
    }

    const result = await this.pool!.query({ name: this.hitQ.name, text: this.hitQ.text, values: [key, resetAt, now] })
    return { count: Number(result.rows[0].count), resetAt: Number(result.rows[0].reset_at) }
  }

  async hitWithBan(key: string, windowMs: number, limit: number, banThreshold: number, banDurationMs: number): Promise<HitWithBanResult> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()
    const resetAt = now + windowMs
    const banExpiresAt = now + banDurationMs

    if (this.mode === 'bun') {
      // Check ban first
      const banRows = await this.client!.unsafe(this.banCheckQText, [key, now])
      if (banRows.length > 0) {
        return { count: 0, resetAt, banned: true, violations: 0, banExpiresAt: Number(banRows[0].expires_at) }
      }

      // Atomic hit upsert
      const hitRows = await this.client!.unsafe(this.hitQText, [key, resetAt, now])
      const hitCount = Number(hitRows[0].count)
      const hitResetAt = Number(hitRows[0].reset_at)

      if (hitCount > limit) {
        const violRows = await this.client!.unsafe(this.violationQText, [key, banExpiresAt, now])
        const violations = Number(violRows[0].count)
        const shouldBan = violations >= banThreshold

        if (shouldBan) {
          await this.client!.unsafe(this.banSetQText, [key, banExpiresAt])
        }

        return { count: hitCount, resetAt: hitResetAt, banned: shouldBan, violations, banExpiresAt: shouldBan ? banExpiresAt : 0 }
      }

      return { count: hitCount, resetAt: hitResetAt, banned: false, violations: 0, banExpiresAt: 0 }
    }

    // pg mode
    const banResult = await this.pool!.query({ name: this.banCheckQ.name, text: this.banCheckQ.text, values: [key, now] })
    if (banResult.rows.length > 0) {
      return { count: 0, resetAt, banned: true, violations: 0, banExpiresAt: Number(banResult.rows[0].expires_at) }
    }

    const hitResult = await this.pool!.query({ name: this.hitQ.name, text: this.hitQ.text, values: [key, resetAt, now] })
    const hitCount = Number(hitResult.rows[0].count)
    const hitResetAt = Number(hitResult.rows[0].reset_at)

    if (hitCount > limit) {
      const violationResult = await this.pool!.query({ name: this.violationQ.name, text: this.violationQ.text, values: [key, banExpiresAt, now] })
      const violations = Number(violationResult.rows[0].count)
      const shouldBan = violations >= banThreshold

      if (shouldBan) {
        await this.pool!.query({ name: this.banSetQ.name, text: this.banSetQ.text, values: [key, banExpiresAt] })
      }

      return { count: hitCount, resetAt: hitResetAt, banned: shouldBan, violations, banExpiresAt: shouldBan ? banExpiresAt : 0 }
    }

    return { count: hitCount, resetAt: hitResetAt, banned: false, violations: 0, banExpiresAt: 0 }
  }

  async isBanned(key: string): Promise<boolean> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()

    if (this.mode === 'bun') {
      const rows = await this.client!.unsafe(this.isBannedQText, [key, now])
      return rows.length > 0
    }

    const result = await this.pool!.query({ name: this.isBannedQ.name, text: this.isBannedQ.text, values: [key, now] })
    return result.rows.length > 0
  }

  async ban(key: string, durationMs: number): Promise<void> {
    if (!this.ready) await this.tablesReady
    const expiresAt = Date.now() + durationMs

    if (this.mode === 'bun') {
      await this.client!.unsafe(this.banSetQText, [key, expiresAt])
    } else {
      await this.pool!.query({ name: this.banSetQ.name, text: this.banSetQ.text, values: [key, expiresAt] })
    }
  }

  async recordViolation(key: string, windowMs: number): Promise<number> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()
    const resetAt = now + windowMs

    if (this.mode === 'bun') {
      const rows = await this.client!.unsafe(this.violationQText, [key, resetAt, now])
      return Number(rows[0].count)
    }

    const result = await this.pool!.query({ name: this.violationQ.name, text: this.violationQ.text, values: [key, resetAt, now] })
    return Number(result.rows[0].count)
  }

  async reset(key: string): Promise<void> {
    if (!this.ready) await this.tablesReady

    if (this.mode === 'bun') {
      await this.client!.unsafe(this.resetHitsQ, [key])
      await this.client!.unsafe(this.resetBansQ, [key])
      await this.client!.unsafe(this.resetViolationsQ, [key])
    } else {
      await this.pool!.query(this.resetHitsQ, [key])
      await this.pool!.query(this.resetBansQ, [key])
      await this.pool!.query(this.resetViolationsQ, [key])
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const now = Date.now()
      if (this.mode === 'bun') {
        await this.client!.unsafe(this.cleanupHitsQ, [now])
        await this.client!.unsafe(this.cleanupBansQ, [now])
        await this.client!.unsafe(this.cleanupViolationsQ, [now])
      } else {
        await this.pool!.query(this.cleanupHitsQ, [now])
        await this.pool!.query(this.cleanupBansQ, [now])
        await this.pool!.query(this.cleanupViolationsQ, [now])
      }
    } catch { /* Cleanup failures are non-fatal */ }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    // Only close a client the store created from url. Never close caller-owned client or pool.
    if (this.ownsClient && this.client) {
      await this.client.close()
    }
  }
}

export function postgresStore(options: PostgresStoreOptions): HitLimitStore {
  return new PostgresStore(options)
}
