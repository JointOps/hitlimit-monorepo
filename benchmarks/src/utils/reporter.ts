/**
 * Benchmark report generators
 */

import { BenchmarkResult, formatLatency, formatOps } from './stats.js'

export interface ReportMetadata {
  nodeVersion?: string
  bunVersion?: string
  platform: string
  date: string
  commit?: string
}

export function generateMarkdownReport(
  results: BenchmarkResult[],
  metadata: ReportMetadata
): string {
  let md = `# Benchmark Results

**Generated:** ${metadata.date}
${metadata.nodeVersion ? `**Node.js:** ${metadata.nodeVersion}  \n` : ''}${metadata.bunVersion ? `**Bun:** ${metadata.bunVersion}  \n` : ''}**Platform:** ${metadata.platform}
${metadata.commit ? `**Commit:** ${metadata.commit}` : ''}

---

`

  // Group by scenario
  const byScenario = new Map<string, BenchmarkResult[]>()
  for (const r of results) {
    const key = r.scenario
    if (!byScenario.has(key)) byScenario.set(key, [])
    byScenario.get(key)!.push(r)
  }

  for (const [scenario, scenarioResults] of byScenario) {
    md += `## ${scenario}\n\n`

    // Sort by ops/sec descending
    const sorted = [...scenarioResults].sort((a, b) => b.opsPerSec - a.opsPerSec)
    const fastest = sorted[0]

    md += `| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |\n`
    md += `|---------|---------|-----|-----|-----|-----|------------|\n`

    for (const result of sorted) {
      const relative = result === fastest
        ? '1st'
        : `${((result.opsPerSec / fastest.opsPerSec) * 100).toFixed(0)}%`

      md += `| ${result.name} | ${formatOps(result.opsPerSec)} | ${formatLatency(result.avgLatencyNs)} | ${formatLatency(result.p50LatencyNs)} | ${formatLatency(result.p95LatencyNs)} | ${formatLatency(result.p99LatencyNs)} | ${relative} |\n`
    }

    md += `\n`
  }

  // Summary
  md += `## Summary\n\n`

  const hitlimitResults = results.filter(r => r.name.toLowerCase().includes('hitlimit'))
  const competitorResults = results.filter(r => !r.name.toLowerCase().includes('hitlimit'))

  if (hitlimitResults.length > 0 && competitorResults.length > 0) {
    // Calculate average relative performance
    const scenarioNames = [...byScenario.keys()]
    let hitlimitWins = 0
    let totalComparisons = 0

    for (const scenario of scenarioNames) {
      const sr = byScenario.get(scenario)!
      const hl = sr.find(r => r.name.toLowerCase().includes('hitlimit') && !r.name.includes('tiered'))
      const competitors = sr.filter(r => !r.name.toLowerCase().includes('hitlimit'))

      for (const comp of competitors) {
        if (hl && comp) {
          totalComparisons++
          if (hl.opsPerSec > comp.opsPerSec) hitlimitWins++
        }
      }
    }

    if (totalComparisons > 0) {
      md += `- hitlimit wins ${hitlimitWins}/${totalComparisons} comparisons\n`
    }
  }

  // Memory usage summary
  const avgMemory = results.reduce((sum, r) => sum + r.memoryUsedMB, 0) / results.length
  md += `- Average memory usage: ${avgMemory.toFixed(2)} MB\n`

  return md
}

export function generateConsoleReport(results: BenchmarkResult[]): string {
  const lines: string[] = [
    '',
    '='.repeat(80),
    'BENCHMARK RESULTS',
    '='.repeat(80),
    ''
  ]

  // Group by scenario
  const byScenario = new Map<string, BenchmarkResult[]>()
  for (const r of results) {
    const key = r.scenario
    if (!byScenario.has(key)) byScenario.set(key, [])
    byScenario.get(key)!.push(r)
  }

  for (const [scenario, scenarioResults] of byScenario) {
    lines.push(`\n[${scenario}]`)
    lines.push('-'.repeat(60))

    const sorted = [...scenarioResults].sort((a, b) => b.opsPerSec - a.opsPerSec)
    const fastest = sorted[0]

    for (const r of sorted) {
      const relative = r === fastest
        ? '(fastest)'
        : `(${((r.opsPerSec / fastest.opsPerSec) * 100).toFixed(0)}%)`

      lines.push(`  ${r.name}`)
      lines.push(`    Throughput: ${formatOps(r.opsPerSec)} ops/sec ${relative}`)
      lines.push(`    Latency:    avg=${formatLatency(r.avgLatencyNs)} p50=${formatLatency(r.p50LatencyNs)} p95=${formatLatency(r.p95LatencyNs)} p99=${formatLatency(r.p99LatencyNs)}`)
      lines.push(`    Memory:     ${r.memoryUsedMB.toFixed(2)} MB`)
      lines.push(`    +/- ${formatLatency(r.marginOfError)} (95% CI)`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function generateJSONReport(
  results: BenchmarkResult[],
  metadata: ReportMetadata
): string {
  return JSON.stringify({
    metadata,
    results
  }, null, 2)
}
