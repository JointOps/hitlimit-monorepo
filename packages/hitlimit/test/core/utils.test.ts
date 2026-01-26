import { describe, it, expect } from 'vitest'
import { parseWindow } from '../../src/core/utils.js'

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

  it('handles zero values', () => {
    expect(parseWindow('0s')).toBe(0)
    expect(parseWindow('0m')).toBe(0)
    expect(parseWindow(0)).toBe(0)
  })

  it('handles large values', () => {
    expect(parseWindow('365d')).toBe(365 * 86400000)
    expect(parseWindow('1000h')).toBe(1000 * 3600000)
  })

  it('handles decimal in number passthrough', () => {
    expect(parseWindow(1500.5)).toBe(1500.5)
  })

  it('throws on negative values', () => {
    expect(() => parseWindow('-1s')).toThrow()
    expect(() => parseWindow('-5m')).toThrow()
  })

  it('handles leading zeros', () => {
    expect(parseWindow('01s')).toBe(1000)
    expect(parseWindow('001m')).toBe(60000)
  })
})

