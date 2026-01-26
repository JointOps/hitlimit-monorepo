import { describe, it, expect } from 'bun:test'
import { buildHeaders } from '../../src/core/headers'
import type { HitLimitInfo } from '@joint-ops/hitlimit-types'

const baseInfo: HitLimitInfo = {
  limit: 100,
  remaining: 50,
  resetIn: 30,
  resetAt: Date.now() + 30000,
  key: 'test-key'
}

describe('buildHeaders', () => {
  it('builds standard headers when enabled', () => {
    const headers = buildHeaders(
      baseInfo,
      { standard: true, legacy: false, retryAfter: false },
      true
    )

    expect(headers['RateLimit-Limit']).toBe('100')
    expect(headers['RateLimit-Remaining']).toBe('50')
    expect(headers['RateLimit-Reset']).toBeDefined()
    expect(headers['X-RateLimit-Limit']).toBeUndefined()
  })

  it('builds legacy headers when enabled', () => {
    const headers = buildHeaders(
      baseInfo,
      { standard: false, legacy: true, retryAfter: false },
      true
    )

    expect(headers['X-RateLimit-Limit']).toBe('100')
    expect(headers['X-RateLimit-Remaining']).toBe('50')
    expect(headers['X-RateLimit-Reset']).toBeDefined()
    expect(headers['RateLimit-Limit']).toBeUndefined()
  })

  it('builds both standard and legacy headers', () => {
    const headers = buildHeaders(
      baseInfo,
      { standard: true, legacy: true, retryAfter: false },
      true
    )

    expect(headers['RateLimit-Limit']).toBe('100')
    expect(headers['X-RateLimit-Limit']).toBe('100')
  })

  it('adds Retry-After only when not allowed', () => {
    const headersAllowed = buildHeaders(
      baseInfo,
      { standard: true, legacy: true, retryAfter: true },
      true
    )
    expect(headersAllowed['Retry-After']).toBeUndefined()

    const headersBlocked = buildHeaders(
      baseInfo,
      { standard: true, legacy: true, retryAfter: true },
      false
    )
    expect(headersBlocked['Retry-After']).toBe('30')
  })

  it('does not add Retry-After when disabled', () => {
    const headers = buildHeaders(
      baseInfo,
      { standard: true, legacy: true, retryAfter: false },
      false
    )
    expect(headers['Retry-After']).toBeUndefined()
  })

  it('returns empty object when all headers disabled', () => {
    const headers = buildHeaders(
      baseInfo,
      { standard: false, legacy: false, retryAfter: false },
      true
    )
    expect(Object.keys(headers)).toHaveLength(0)
  })

  it('uses seconds for reset timestamp', () => {
    const now = Date.now()
    const info: HitLimitInfo = { ...baseInfo, resetAt: now + 60000 }
    const headers = buildHeaders(
      info,
      { standard: true, legacy: false, retryAfter: false },
      true
    )

    const resetTimestamp = parseInt(headers['RateLimit-Reset'])
    expect(resetTimestamp).toBe(Math.ceil((now + 60000) / 1000))
  })

  it('handles zero remaining', () => {
    const info: HitLimitInfo = { ...baseInfo, remaining: 0 }
    const headers = buildHeaders(
      info,
      { standard: true, legacy: false, retryAfter: false },
      false
    )

    expect(headers['RateLimit-Remaining']).toBe('0')
  })

  it('handles high limit values', () => {
    const info: HitLimitInfo = { ...baseInfo, limit: 1000000, remaining: 999999 }
    const headers = buildHeaders(
      info,
      { standard: true, legacy: false, retryAfter: false },
      true
    )

    expect(headers['RateLimit-Limit']).toBe('1000000')
    expect(headers['RateLimit-Remaining']).toBe('999999')
  })
})
