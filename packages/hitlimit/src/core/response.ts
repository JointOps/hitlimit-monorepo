import type { HitLimitInfo, ResponseConfig, ResponseFormatter } from '@joint-ops/hitlimit-types'

export function buildBody(
  response: ResponseConfig | ResponseFormatter,
  info: HitLimitInfo
): Record<string, any> {
  if (typeof response === 'function') {
    return response(info)
  }

  const body: Record<string, any> = {
    ...response,
    limit: info.limit,
    remaining: info.remaining,
    resetIn: info.resetIn
  }

  if (info.banned) {
    body.banned = true
    body.banExpiresAt = info.banExpiresAt
    body.message = 'You have been temporarily banned due to repeated rate limit violations'
  }

  return body
}
