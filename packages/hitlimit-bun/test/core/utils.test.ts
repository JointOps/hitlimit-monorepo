import { describe, it, expect } from 'bun:test'
import { parseWindow } from '../../src/core/utils'

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

  it('handles zero values', () => {
    expect(parseWindow(0)).toBe(0)
    expect(parseWindow('0s')).toBe(0)
    expect(parseWindow('0m')).toBe(0)
  })

  it('handles large values', () => {
    expect(parseWindow(2147483647)).toBe(2147483647)
    expect(parseWindow('999999s')).toBe(999999000)
    expect(parseWindow('365d')).toBe(31536000000)
  })

  it('handles decimal in number passthrough', () => {
    expect(parseWindow(1500.5)).toBe(1500.5)
    expect(parseWindow(60000.99)).toBe(60000.99)
  })

  it('passes through negative numbers', () => {
    expect(parseWindow(-100)).toBe(-100)
    expect(parseWindow(-5000)).toBe(-5000)
  })

  it('handles leading zeros', () => {
    expect(parseWindow('01s')).toBe(1000)
    expect(parseWindow('005m')).toBe(300000)
    expect(parseWindow('0010h')).toBe(36000000)
  })

  it('throws on invalid format', () => {
    expect(() => parseWindow('invalid')).toThrow()
    expect(() => parseWindow('10x')).toThrow()
    expect(() => parseWindow('')).toThrow()
  })
})

