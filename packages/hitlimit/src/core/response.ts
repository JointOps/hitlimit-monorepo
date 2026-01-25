import type { HitLimitInfo, ResponseConfig, ResponseFormatter } from '@hitlimit/types'

export function buildBody(
  response: ResponseConfig | ResponseFormatter,
  info: HitLimitInfo
): Record<string, any> {
  if (typeof response === 'function') {
    return response(info)
  }

  return {
    ...response,
    limit: info.limit,
    remaining: info.remaining,
    resetIn: info.resetIn
  }
}
