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

  async hit(key: string, windowMs: number, _limit: number): Promise<StoreResult> {
    if (!this.ready) await this.indexesReady
    const now = Date.now()
    const resetAt = now + windowMs

    const result = await this.col('hits').findOneAndUpdate(
      { key },
      [{
        $set: {
          count: {
            $cond: {
              if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
              then: { $add: ['$count', 1] },
              else: 1
            }
          },
          resetAt: {
            $cond: {
              if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
              then: '$resetAt',
              else: resetAt
            }
          },
          expireAt: {
            $cond: {
              if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
              then: '$expireAt',
              else: new Date(resetAt)
            }
          }
        }
      }],
      { upsert: true, returnDocument: 'after' }
    )
    return { count: result.count, resetAt: result.resetAt }
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
    const hitResult = await this.col('hits').findOneAndUpdate(
      { key },
      [{
        $set: {
          count: {
            $cond: {
              if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
              then: { $add: ['$count', 1] },
              else: 1
            }
          },
          resetAt: {
            $cond: {
              if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
              then: '$resetAt',
              else: resetAt
            }
          },
          expireAt: {
            $cond: {
              if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
              then: '$expireAt',
              else: new Date(resetAt)
            }
          }
        }
      }],
      { upsert: true, returnDocument: 'after' }
    )

    const hitCount = hitResult.count
    const hitResetAt = hitResult.resetAt

    // Track violations if over limit
    if (hitCount > limit) {
      const violationResult = await this.col('violations').findOneAndUpdate(
        { key },
        [{
          $set: {
            count: {
              $cond: {
                if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
                then: { $add: ['$count', 1] },
                else: 1
              }
            },
            resetAt: {
              $cond: {
                if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
                then: '$resetAt',
                else: banExpiresAt
              }
            },
            expireAt: {
              $cond: {
                if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
                then: '$expireAt',
                else: new Date(banExpiresAt)
              }
            }
          }
        }],
        { upsert: true, returnDocument: 'after' }
      )

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
    const now = Date.now()
    const resetAt = now + windowMs

    const result = await this.col('violations').findOneAndUpdate(
      { key },
      [{
        $set: {
          count: {
            $cond: {
              if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
              then: { $add: ['$count', 1] },
              else: 1
            }
          },
          resetAt: {
            $cond: {
              if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
              then: '$resetAt',
              else: resetAt
            }
          },
          expireAt: {
            $cond: {
              if: { $and: [{ $gt: ['$resetAt', null] }, { $gt: ['$resetAt', now] }] },
              then: '$expireAt',
              else: new Date(resetAt)
            }
          }
        }
      }],
      { upsert: true, returnDocument: 'after' }
    )
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
