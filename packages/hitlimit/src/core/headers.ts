import type { HitLimitInfo, HeadersConfig } from '@joint-ops/hitlimit-types'

export function buildHeaders(
  info: HitLimitInfo,
  config: Required<HeadersConfig>,
  allowed: boolean
): Record<string, string> {
  const headers: Record<string, string> = {}

  if (config.standard) {
    headers['RateLimit-Limit'] = String(info.limit)
    headers['RateLimit-Remaining'] = String(info.remaining)
    headers['RateLimit-Reset'] = String(Math.ceil(info.resetAt / 1000))
  }

  if (config.legacy) {
    headers['X-RateLimit-Limit'] = String(info.limit)
    headers['X-RateLimit-Remaining'] = String(info.remaining)
    headers['X-RateLimit-Reset'] = String(Math.ceil(info.resetAt / 1000))
  }

  if (!allowed && config.retryAfter) {
    // When banned, Retry-After reflects ban duration, not window reset
    headers['Retry-After'] = String(info.resetIn)
  }

  if (info.banned) {
    headers['X-RateLimit-Ban'] = 'true'
    if (info.banExpiresAt) {
      headers['X-RateLimit-Ban-Expires'] = String(Math.ceil(info.banExpiresAt / 1000))
    }
  }

  return headers
}
