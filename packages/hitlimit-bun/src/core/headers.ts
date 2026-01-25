import type { HitLimitInfo, HeadersConfig } from '@hitlimit/types'

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
    headers['Retry-After'] = String(info.resetIn)
  }

  return headers
}
