import { describe, it, expect } from 'vitest'
import { parseWindow, hashKey } from '../../src/core/utils.js'

describe('parseWindow', () => {
  it('parses seconds', () => {
    expect(parseWindow('1s')).toBe(1000)
    expect(parseWindow('30s')).toBe(30000)
  })

  it('parses minutes', () => {
    expect(parseWindow('1m')).toBe(60000)
    expect(parseWindow('15m')).toBe(900000)
  })

  it('parses hours', () => {
    expect(parseWindow('1h')).toBe(3600000)
    expect(parseWindow('24h')).toBe(86400000)
  })

  it('parses days', () => {
    expect(parseWindow('1d')).toBe(86400000)
    expect(parseWindow('7d')).toBe(604800000)
  })

  it('passes through numbers', () => {
    expect(parseWindow(5000)).toBe(5000)
    expect(parseWindow(60000)).toBe(60000)
  })

  it('throws on invalid format', () => {
    expect(() => parseWindow('invalid')).toThrow()
    expect(() => parseWindow('10x')).toThrow()
    expect(() => parseWindow('')).toThrow()
  })
})

describe('hashKey', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = hashKey('test-key')
    const hash2 = hashKey('test-key')
    expect(hash1).toBe(hash2)
  })

  it('returns different hash for different input', () => {
    const hash1 = hashKey('key1')
    const hash2 = hashKey('key2')
    expect(hash1).not.toBe(hash2)
  })

  it('returns fixed length string', () => {
    const hash = hashKey('any-key')
    expect(hash.length).toBe(16)
  })
})
