import type { HitLimitStore, HitWithBanResult, StoreResult } from '@joint-ops/hitlimit-types'

export interface MySQLStoreOptions {
  /** mysql2/promise Pool instance */
  pool: any
  /** Table name prefix. Default: 'hitlimit' */
  tablePrefix?: string
  /** Cleanup interval in ms. Default: 60000 (1 minute) */
  cleanupInterval?: number
  /** Skip table creation (if you manage schema yourself). Default: false */
  skipTableCreation?: boolean
}

class MySQLStore implements HitLimitStore {
  private pool: any
  private prefix: string
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private tablesReady: Promise<void> | null = null
  private ready: boolean

  constructor(options: MySQLStoreOptions) {
    this.pool = options.pool
    this.prefix = options.tablePrefix ?? 'hitlimit'

    if (options.skipTableCreation) {
      this.ready = true
    } else {
      this.ready = false
      this.tablesReady = this.createTables().then(() => { this.ready = true })
    }

    const interval = options.cleanupInterval ?? 60_000
    this.cleanupTimer = setInterval(() => this.cleanup(), interval)
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  private async createTables(): Promise<void> {
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}_hits (
        \`key\` VARCHAR(255) NOT NULL PRIMARY KEY,
        count INT NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      ) ENGINE=InnoDB
    `)
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}_bans (
        \`key\` VARCHAR(255) NOT NULL PRIMARY KEY,
        expires_at BIGINT NOT NULL
      ) ENGINE=InnoDB
    `)
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}_violations (
        \`key\` VARCHAR(255) NOT NULL PRIMARY KEY,
        count INT NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      ) ENGINE=InnoDB
    `)
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()
    const resetAt = now + windowMs
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(`
        INSERT INTO ${this.prefix}_hits (\`key\`, count, reset_at)
        VALUES (?, LAST_INSERT_ID(1), ?)
        ON DUPLICATE KEY UPDATE
          count = LAST_INSERT_ID(IF(reset_at <= ?, 1, count + 1)),
          reset_at = IF(reset_at <= ?, ?, reset_at)
      `, [key, resetAt, now, now, resetAt])
      const [rows] = await conn.execute(
        `SELECT LAST_INSERT_ID() AS count, reset_at FROM ${this.prefix}_hits WHERE \`key\` = ?`, [key]
      )
      return { count: Number((rows as any)[0].count), resetAt: Number((rows as any)[0].reset_at) }
    } finally {
      conn.release()
    }
  }

  async hitWithBan(key: string, windowMs: number, limit: number, banThreshold: number, banDurationMs: number): Promise<HitWithBanResult> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()
    const resetAt = now + windowMs
    const banExpiresAt = now + banDurationMs

    // Check ban first
    const [banRows] = await this.pool.execute(
      `SELECT expires_at FROM ${this.prefix}_bans WHERE \`key\` = ? AND expires_at > ?`,
      [key, now]
    )
    if (banRows.length > 0) {
      return {
        count: 0,
        resetAt,
        banned: true,
        violations: 0,
        banExpiresAt: Number(banRows[0].expires_at)
      }
    }

    // Atomic hit — use dedicated connection + LAST_INSERT_ID for race-free count
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(`
        INSERT INTO ${this.prefix}_hits (\`key\`, count, reset_at)
        VALUES (?, LAST_INSERT_ID(1), ?)
        ON DUPLICATE KEY UPDATE
          count = LAST_INSERT_ID(IF(reset_at <= ?, 1, count + 1)),
          reset_at = IF(reset_at <= ?, ?, reset_at)
      `, [key, resetAt, now, now, resetAt])
      const [hitRows] = await conn.execute(
        `SELECT LAST_INSERT_ID() AS count, reset_at FROM ${this.prefix}_hits WHERE \`key\` = ?`, [key]
      )

      const hitCount = Number((hitRows as any)[0].count)
      const hitResetAt = Number((hitRows as any)[0].reset_at)

      // Track violations if over limit
      if (hitCount > limit) {
        await conn.execute(`
          INSERT INTO ${this.prefix}_violations (\`key\`, count, reset_at)
          VALUES (?, LAST_INSERT_ID(1), ?)
          ON DUPLICATE KEY UPDATE
            count = LAST_INSERT_ID(IF(reset_at <= ?, 1, count + 1)),
            reset_at = IF(reset_at <= ?, ?, reset_at)
        `, [key, banExpiresAt, now, now, banExpiresAt])
        const [violRows] = await conn.execute(
          `SELECT LAST_INSERT_ID() AS count FROM ${this.prefix}_violations WHERE \`key\` = ?`, [key]
        )

        const violations = Number((violRows as any)[0].count)
        const shouldBan = violations >= banThreshold

        if (shouldBan) {
          await conn.execute(`
            INSERT INTO ${this.prefix}_bans (\`key\`, expires_at) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE expires_at = ?
          `, [key, banExpiresAt, banExpiresAt])
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
    } finally {
      conn.release()
    }
  }

  async isBanned(key: string): Promise<boolean> {
    if (!this.ready) await this.tablesReady
    const [rows] = await this.pool.execute(
      `SELECT 1 FROM ${this.prefix}_bans WHERE \`key\` = ? AND expires_at > ?`,
      [key, Date.now()]
    )
    return rows.length > 0
  }

  async ban(key: string, durationMs: number): Promise<void> {
    if (!this.ready) await this.tablesReady
    const expiresAt = Date.now() + durationMs
    await this.pool.execute(`
      INSERT INTO ${this.prefix}_bans (\`key\`, expires_at) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE expires_at = ?
    `, [key, expiresAt, expiresAt])
  }

  async recordViolation(key: string, windowMs: number): Promise<number> {
    if (!this.ready) await this.tablesReady
    const now = Date.now()
    const resetAt = now + windowMs
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(`
        INSERT INTO ${this.prefix}_violations (\`key\`, count, reset_at) VALUES (?, LAST_INSERT_ID(1), ?)
        ON DUPLICATE KEY UPDATE
          count = LAST_INSERT_ID(IF(reset_at <= ?, 1, count + 1)),
          reset_at = IF(reset_at <= ?, ?, reset_at)
      `, [key, resetAt, now, now, resetAt])
      const [rows] = await conn.execute(
        `SELECT LAST_INSERT_ID() AS count FROM ${this.prefix}_violations WHERE \`key\` = ?`, [key]
      )
      return Number((rows as any)[0].count)
    } finally {
      conn.release()
    }
  }

  async reset(key: string): Promise<void> {
    if (!this.ready) await this.tablesReady
    await Promise.all([
      this.pool.execute(`DELETE FROM ${this.prefix}_hits WHERE \`key\` = ?`, [key]),
      this.pool.execute(`DELETE FROM ${this.prefix}_bans WHERE \`key\` = ?`, [key]),
      this.pool.execute(`DELETE FROM ${this.prefix}_violations WHERE \`key\` = ?`, [key])
    ])
  }

  private async cleanup(): Promise<void> {
    try {
      const now = Date.now()
      await this.pool.execute(`DELETE FROM ${this.prefix}_hits WHERE reset_at <= ?`, [now])
      await this.pool.execute(`DELETE FROM ${this.prefix}_bans WHERE expires_at <= ?`, [now])
      await this.pool.execute(`DELETE FROM ${this.prefix}_violations WHERE reset_at <= ?`, [now])
    } catch { /* Cleanup failures are non-fatal */ }
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

export function mysqlStore(options: MySQLStoreOptions): HitLimitStore {
  return new MySQLStore(options)
}
