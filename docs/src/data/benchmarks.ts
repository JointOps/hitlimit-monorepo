import data from './benchmarks.json'

export const bench = data

/** Format ops/sec: 3160000 → "3.16M", 6700 → "6.7K", 749000 → "749K" */
export function formatOps(n: number): string {
  if (n >= 1_000_000) {
    const val = n / 1_000_000
    return val >= 10 ? `${Math.round(val)}M` : `${parseFloat(val.toFixed(2))}M`
  }
  if (n >= 1_000) {
    const val = n / 1_000
    return val >= 100 ? `${Math.round(val)}K` : `${parseFloat(val.toFixed(1))}K`
  }
  return n.toString()
}

/** Format ops with "+" suffix: 3160000 → "3.16M+" */
export function formatOpsPlus(n: number): string {
  return `${formatOps(n)}+`
}

/** Format ops with commas: 3160000 → "3,160,000" */
export function formatOpsComma(n: number): string {
  return n.toLocaleString('en-US')
}

/** Format ops with commas and "+": 3160000 → "3,160,000+" */
export function formatOpsCommaPlus(n: number): string {
  return `${formatOpsComma(n)}+`
}

/** Format latency from nanoseconds: 316 → "316ns", 150000 → "150μs", 2800 → "2.8μs" */
export function formatLatency(ns: number): string {
  if (ns >= 1_000_000) {
    const val = ns / 1_000_000
    return `${parseFloat(val.toFixed(1))}ms`
  }
  if (ns >= 1_000) {
    const val = ns / 1_000
    return val === Math.floor(val) ? `${val}μs` : `${parseFloat(val.toFixed(1))}μs`
  }
  return `${ns}ns`
}

/** Format latency with tilde: 316 → "~316ns" */
export function formatLatencyApprox(ns: number): string {
  return `~${formatLatency(ns)}`
}

/** Compute speedup ratio: speedup(3160000, 1140000) → "2.8x" */
export function speedup(faster: number, slower: number): string {
  return `${(faster / slower).toFixed(1)}x`
}

/** Compute percentage of fastest: pctOfFastest(1140000, 3160000) → "36%" */
export function pctOfFastest(value: number, fastest: number): string {
  return `${Math.round((value / fastest) * 100)}%`
}

/** Compute overhead percentage: overheadPct(45000, 42000) → "~7%" */
export function overheadPct(without: number, withLimiter: number): string {
  return `~${Math.round((1 - withLimiter / without) * 100)}%`
}

/** Format an ops/sec range: opsRange(352000, 455000) → "352-455K" */
export function opsRange(low: number, high: number): string {
  if (low >= 1_000_000 && high >= 1_000_000) {
    const l = parseFloat((low / 1_000_000).toFixed(2))
    const h = parseFloat((high / 1_000_000).toFixed(2))
    return `${l}-${h}M`
  }
  if (low >= 1_000 && high >= 1_000) {
    const l = Math.round(low / 1_000)
    const h = Math.round(high / 1_000)
    return `${l}-${h}K`
  }
  return `${low}-${high}`
}

/** Format ops/sec range with "K": opsRangeDecimal(6700, 6900) → "6.7-6.9K" */
export function opsRangeDecimal(low: number, high: number): string {
  if (low >= 1_000_000 && high >= 1_000_000) {
    const l = parseFloat((low / 1_000_000).toFixed(2))
    const h = parseFloat((high / 1_000_000).toFixed(2))
    return `${l}-${h}M`
  }
  if (low >= 1_000 && high >= 1_000) {
    const l = parseFloat((low / 1_000).toFixed(1))
    const h = parseFloat((high / 1_000).toFixed(1))
    return `${l}-${h}K`
  }
  return `${low}-${high}`
}

/** Format number in millions with 1 decimal for stat counters: 3160000 → 3.15 */
export function toMillions(n: number, decimals = 2): number {
  return parseFloat((n / 1_000_000).toFixed(decimals))
}

/** Format req/sec with commas: 45000 → "45,000 req/s" */
export function formatReqSec(n: number): string {
  return `${n.toLocaleString('en-US')} req/s`
}
