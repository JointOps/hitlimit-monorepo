import type { HitLimitStore, HitWithBanResult, StoreResult } from '@joint-ops/hitlimit-types'

export interface MongoStoreOptions {
  /** MongoDB Db instance (from MongoClient.db()) */
  db: any
  /** Collection name prefix. Default: 'hitlimit' */
  collectionPrefix?: string
  /** Skip TTL index creation (if you manage indexes yourself). Default: false */
  skipIndexCreation?: boolean
}

class MongoStore implements HitLimitStore {
  private db: any
  private prefix: string
  private indexesReady: Promise<void> | null = null
  private ready: boolean

  constructor(options: MongoStoreOptions) {
    this.db = options.db
    this.prefix = options.collectionPrefix ?? 'hitlimit'

    if (options.skipIndexCreation) {
      this.ready = true
    } else {
      this.ready = false
      this.indexesReady = this.createIndexes().then(() => { this.ready = true })
    }
  }

  private col(name: string) {
    return this.db.collection(`${this.prefix}_${name}`)
  }

  private async createIndexes(): Promise<void> {
    // TTL indexes — MongoDB auto-deletes documents when expireAt passes
    await this.col('hits').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })
    await this.col('bans').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })
    await this.col('violations').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })

    // Unique key indexes — for upsert operations
    await this.col('hits').createIndex({ key: 1 }, { unique: true })
    await this.col('bans').createIndex({ key: 1 }, { unique: true })
    await this.col('violations').createIndex({ key: 1 }, { unique: true })
  }

  /**
   * Atomic increment using $inc + $setOnInsert (fast path).
   * If the document's window has expired but MongoDB TTL hasn't cleaned it yet,
   * we get an E11000 duplicate key error on upsert — in that case we replace
   * the expired document and retry.
   */
  private async atomicIncrement(
    collection: any,
    key: string,
    windowMs: number
  ): Promise<{ count: number; resetAt: number }> {
    const now = Date.now()
    const resetAt = now + windowMs
    const expireAt = new Date(resetAt)

    try {
      const result = await collection.findOneAndUpdate(
        { key, resetAt: { $gt: now } },
        {
          $inc: { count: 1 },
          $setOnInsert: { key, resetAt, expireAt }
        },
        { upsert: true, returnDocument: 'after' }
      )
      return { count: result.count, resetAt: result.resetAt }
    } catch (err: any) {
      if (err?.code === 11000) {
        // Expired doc exists but TTL hasn't cleaned it — replace it
        const replaced = await collection.findOneAndUpdate(
          { key, resetAt: { $lte: now } },
          { $set: { count: 1, resetAt, expireAt } },
          { returnDocument: 'after' }
        )
        if (replaced) {
          return { count: replaced.count, resetAt: replaced.resetAt }
        }
        // Another thread beat us to the replace — retry the fast path
        return this.atomicIncrement(collection, key, windowMs)
      }
      throw err
    }
  }

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    if (!this.ready) await this.indexesReady
    return this.atomicIncrement(this.col('hits'), key, windowMs)
  }

  async hitWithBan(key: string, windowMs: number, limit: number, banThreshold: number, banDurationMs: number): Promise<HitWithBanResult> {
    if (!this.ready) await this.indexesReady
    const now = Date.now()
    const resetAt = now + windowMs
    const banExpiresAt = now + banDurationMs

    // Check ban first
    const ban = await this.col('bans').findOne({ key, expiresAt: { $gt: now } })
    if (ban) {
      return {
        count: 0,
        resetAt,
        banned: true,
        violations: 0,
        banExpiresAt: ban.expiresAt
      }
    }

    // Atomic hit
    const hitResult = await this.atomicIncrement(this.col('hits'), key, windowMs)
    const hitCount = hitResult.count
    const hitResetAt = hitResult.resetAt

    // Track violations if over limit
    if (hitCount > limit) {
      const violationResult = await this.atomicIncrement(this.col('violations'), key, banDurationMs)
      const violations = violationResult.count
      const shouldBan = violations >= banThreshold

      if (shouldBan) {
        await this.col('bans').updateOne(
          { key },
          { $set: { expiresAt: banExpiresAt, expireAt: new Date(banExpiresAt) } },
          { upsert: true }
        )
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
    if (!this.ready) await this.indexesReady
    const ban = await this.col('bans').findOne({ key, expiresAt: { $gt: Date.now() } })
    return ban !== null
  }

  async ban(key: string, durationMs: number): Promise<void> {
    if (!this.ready) await this.indexesReady
    const expiresAt = Date.now() + durationMs
    await this.col('bans').updateOne(
      { key },
      { $set: { expiresAt, expireAt: new Date(expiresAt) } },
      { upsert: true }
    )
  }

  async recordViolation(key: string, windowMs: number): Promise<number> {
    if (!this.ready) await this.indexesReady
    const result = await this.atomicIncrement(this.col('violations'), key, windowMs)
    return result.count
  }

  async reset(key: string): Promise<void> {
    if (!this.ready) await this.indexesReady
    await Promise.all([
      this.col('hits').deleteOne({ key }),
      this.col('bans').deleteOne({ key }),
      this.col('violations').deleteOne({ key })
    ])
  }

  shutdown(): void {
    // No cleanup timer — MongoDB TTL indexes handle document expiration automatically
  }
}

export function mongoStore(options: MongoStoreOptions): HitLimitStore {
  return new MongoStore(options)
}
