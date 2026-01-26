import { describe, it, expect } from 'vitest'
import { buildBody } from '../../src/core/response.js'
import type { HitLimitInfo } from '@joint-ops/hitlimit-types'

const baseInfo: HitLimitInfo = {
  limit: 100,
  remaining: 0,
  resetIn: 42,
  resetAt: Date.now() + 42000,
  key: 'test-key'
}

describe('buildBody', () => {
  it('merges static response with info', () => {
    const response = { hitlimit: true, message: 'Too many requests' }
    const body = buildBody(response, baseInfo)

    expect(body.hitlimit).toBe(true)
    expect(body.message).toBe('Too many requests')
    expect(body.limit).toBe(100)
    expect(body.remaining).toBe(0)
    expect(body.resetIn).toBe(42)
  })

  it('calls response function with info', () => {
    const response = (info: HitLimitInfo) => ({
      error: 'RATE_LIMITED',
      retryAfter: info.resetIn,
      tier: info.tier
    })

    const infoWithTier: HitLimitInfo = { ...baseInfo, tier: 'free' }
    const body = buildBody(response, infoWithTier)

    expect(body.error).toBe('RATE_LIMITED')
    expect(body.retryAfter).toBe(42)
    expect(body.tier).toBe('free')
  })

  it('allows empty response object', () => {
    const body = buildBody({}, baseInfo)

    expect(body.limit).toBe(100)
    expect(body.remaining).toBe(0)
    expect(body.resetIn).toBe(42)
  })

  it('response function can return minimal body', () => {
    const response = () => ({ error: 'limited' })
    const body = buildBody(response, baseInfo)

    expect(body).toEqual({ error: 'limited' })
  })

  it('preserves custom properties from static response', () => {
    const response = {
      code: 429,
      type: 'rate_limit',
      documentation_url: 'https://example.com/docs'
    }
    const body = buildBody(response, baseInfo)

    expect(body.code).toBe(429)
    expect(body.type).toBe('rate_limit')
    expect(body.documentation_url).toBe('https://example.com/docs')
  })

  it('handles info with undefined tier gracefully', () => {
    const infoNoTier: HitLimitInfo = { ...baseInfo, tier: undefined }
    const response = (info: HitLimitInfo) => ({
      message: 'Limited',
      tier: info.tier ?? 'default'
    })
    const body = buildBody(response, infoNoTier)

    expect(body.tier).toBe('default')
  })

  it('handles response function that returns object with undefined values', () => {
    const response = () => ({
      message: 'Limited',
      extra: undefined
    })
    const body = buildBody(response, baseInfo)

    expect(body.message).toBe('Limited')
    expect(body.extra).toBeUndefined()
  })

  it('handles response with numeric values', () => {
    const response = {
      errorCode: 429,
      waitSeconds: 60,
      maxRetries: 3
    }
    const body = buildBody(response, baseInfo)

    expect(body.errorCode).toBe(429)
    expect(body.waitSeconds).toBe(60)
    expect(body.maxRetries).toBe(3)
  })

  it('handles response with nested objects', () => {
    const response = {
      error: {
        code: 'RATE_LIMITED',
        details: { limit: 100 }
      }
    }
    const body = buildBody(response, baseInfo)

    expect(body.error.code).toBe('RATE_LIMITED')
    expect(body.error.details.limit).toBe(100)
  })
})
