import type {
  HitLimitOptions,
  HitLimitStore,
  KeyGenerator,
  ResolvedConfig
} from '@joint-ops/hitlimit-types'
import { parseWindow } from './utils.js'

export function resolveConfig<TRequest>(
  options: HitLimitOptions<TRequest>,
  defaultStore: HitLimitStore,
  defaultKey: KeyGenerator<TRequest>
): ResolvedConfig<TRequest> {
  return {
    limit: options.limit ?? 100,
    windowMs: parseWindow(options.window ?? '1m'),
    key: options.key ?? defaultKey,
    tiers: options.tiers,
    tier: options.tier,
    response: options.response ?? { hitlimit: true, message: 'Whoa there! Rate limit exceeded.' },
    headers: {
      standard: options.headers?.standard ?? true,
      legacy: options.headers?.legacy ?? true,
      retryAfter: options.headers?.retryAfter ?? true
    },
    store: options.store ?? defaultStore,
    onStoreError: options.onStoreError ?? (() => 'allow'),
    skip: options.skip,
    ban: options.ban
      ? { threshold: options.ban.threshold, durationMs: parseWindow(options.ban.duration) }
      : null,
    group: options.group ?? null
  }
}
