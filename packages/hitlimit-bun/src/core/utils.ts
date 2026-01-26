const UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
}

export function parseWindow(window: string | number): number {
  if (typeof window === 'number') return window

  const match = window.match(/^(\d+)(s|m|h|d)$/)
  if (!match) throw new Error(`Invalid window format: ${window}`)

  return parseInt(match[1]) * UNITS[match[2]]
}
