/**
 * Statistical utilities for benchmark analysis
 */

export interface BenchmarkResult {
  name: string
  scenario: string
  runtime: 'node' | 'bun'
  store: string
  iterations: number
  runs: number
  totalMs: number
  opsPerSec: number

  // Latency stats (nanoseconds)
  avgLatencyNs: number
  p50LatencyNs: number
  p95LatencyNs: number
  p99LatencyNs: number
  minLatencyNs: number
  maxLatencyNs: number
  stdDev: number
  marginOfError: number  // 95% CI

  // Memory
  memoryUsedMB: number
}

export interface RunOptions {
  iterations: number
  warmupIterations: number
  runs: number
}

export const DEFAULT_OPTIONS: RunOptions = {
  iterations: 50_000,
  warmupIterations: 5_000,
  runs: 5
}

export function calculateStats(latencies: number[]): {
  avg: number
  p50: number
  p95: number
  p99: number
  min: number
  max: number
  stdDev: number
  marginOfError: number
} {
  const sorted = [...latencies].sort((a, b) => a - b)
  const n = sorted.length

  const sum = sorted.reduce((a, b) => a + b, 0)
  const mean = sum / n

  const squaredDiffs = sorted.map(x => Math.pow(x - mean, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n
  const stdDev = Math.sqrt(variance)

  // 95% confidence interval (z = 1.96)
  const marginOfError = (1.96 * stdDev) / Math.sqrt(n)

  return {
    avg: mean,
    p50: sorted[Math.floor(n * 0.5)],
    p95: sorted[Math.floor(n * 0.95)],
    p99: sorted[Math.floor(n * 0.99)],
    min: sorted[0],
    max: sorted[n - 1],
    stdDev,
    marginOfError
  }
}

export function formatLatency(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(0)}ns`
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(2)}us`
  return `${(ns / 1_000_000).toFixed(2)}ms`
}

export function formatOps(ops: number): string {
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M`
  if (ops >= 1_000) return `${(ops / 1_000).toFixed(1)}K`
  return ops.toFixed(0)
}

export function formatComparison(results: BenchmarkResult[]): string {
  if (results.length < 2) return ''

  const sorted = [...results].sort((a, b) => b.opsPerSec - a.opsPerSec)
  const fastest = sorted[0]

  const lines: string[] = ['\nComparison:']

  for (const result of sorted) {
    const relative = result === fastest
      ? '(fastest)'
      : `${((result.opsPerSec / fastest.opsPerSec) * 100).toFixed(0)}% of fastest`
    lines.push(`  ${result.name}: ${formatOps(result.opsPerSec)} ops/sec ${relative}`)
  }

  return lines.join('\n')
}
