import type { HitLimitStore } from '@joint-ops/hitlimit-types'
import { RedisStore } from './redis'

export interface DragonflyStoreOptions {
  /** DragonflyDB connection URL. Default: 'redis://localhost:6379' */
  url?: string
  /** Key prefix for all rate limit keys. Default: 'hitlimit:' */
  keyPrefix?: string
}

export function dragonflyStore(options?: DragonflyStoreOptions): HitLimitStore {
  return new RedisStore(options)
}
