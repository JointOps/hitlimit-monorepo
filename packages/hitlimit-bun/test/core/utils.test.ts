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

  it('throws on invalid format', () => {
    expect(() => parseWindow('invalid')).toThrow()
    expect(() => parseWindow('10x')).toThrow()
    expect(() => parseWindow('')).toThrow()
  })
})

