/**
 * Benchmark Reporter
 * Generates markdown tables and formatted output from benchmark results
 */

import { BenchmarkResult } from './runner'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

interface ResultsFile {
  timestamp: string
  environment: {
    node?: string
    bun?: string
    platform: string
    arch: string
  }
  results: BenchmarkResult[]
}

/**
 * Format a number with commas for readability
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

/**
 * Format latency in milliseconds
 */
export function formatLatency(ms: number): string {
  if (ms < 0.001) return '<0.001ms'
  if (ms < 1) return `${ms.toFixed(3)}ms`
  return `${ms.toFixed(2)}ms`
}

/**
 * Format memory in MB
 */
export function formatMemory(mb: number): string {
  if (mb < 0) return 'N/A'
  if (mb < 1) return `${(mb * 1024).toFixed(0)}KB`
  return `${mb.toFixed(1)}MB`
}

/**
 * Generate a markdown table from benchmark results
 */
export function generateMarkdownTable(results: BenchmarkResult[]): string {
  const headers = ['Name', 'Ops/sec', 'Avg Latency', 'P50', 'P95', 'P99', 'Memory']
  const separator = headers.map(() => '---')

  const rows = results.map(r => [
    r.name,
    formatNumber(r.opsPerSecond),
    formatLatency(r.avgLatencyMs),
    formatLatency(r.p50LatencyMs),
    formatLatency(r.p95LatencyMs),
    formatLatency(r.p99LatencyMs),
    formatMemory(r.memoryUsedMB)
  ])

  const table = [
    '| ' + headers.join(' | ') + ' |',
    '| ' + separator.join(' | ') + ' |',
    ...rows.map(row => '| ' + row.join(' | ') + ' |')
  ]

  return table.join('\n')
}

/**
 * Generate a simple comparison table (name vs ops/sec)
 */
export function generateComparisonTable(results: BenchmarkResult[]): string {
  const headers = ['Store', 'Operations/sec', 'Avg Latency', 'P99 Latency']
  const separator = headers.map(() => '---')

  const rows = results.map(r => [
    `**${r.name}**`,
    formatNumber(r.opsPerSecond),
    formatLatency(r.avgLatencyMs),
    formatLatency(r.p99LatencyMs)
  ])

  const table = [
    '| ' + headers.join(' | ') + ' |',
    '| ' + separator.join(' | ') + ' |',
    ...rows.map(row => '| ' + row.join(' | ') + ' |')
  ]

  return table.join('\n')
}

/**
 * Generate an ASCII bar chart for ops/sec comparison
 */
export function generateAsciiChart(results: BenchmarkResult[], maxWidth = 50): string {
  const maxOps = Math.max(...results.map(r => r.opsPerSecond))
  const maxNameLen = Math.max(...results.map(r => r.name.length))

  const lines = results.map(r => {
    const barLen = Math.round((r.opsPerSecond / maxOps) * maxWidth)
    const bar = '█'.repeat(barLen) + '░'.repeat(maxWidth - barLen)
    const name = r.name.padEnd(maxNameLen)
    const ops = formatNumber(r.opsPerSecond).padStart(12)
    return `${name}  ${bar}  ${ops} ops/sec`
  })

  return lines.join('\n')
}

/**
 * Generate a Node.js vs Bun comparison chart
 */
export function generateVsChart(
  nodeResults: BenchmarkResult[],
  bunResults: BenchmarkResult[],
  maxWidth = 40
): string {
  const lines: string[] = []
  lines.push('┌' + '─'.repeat(70) + '┐')
  lines.push('│' + 'NODE.JS vs BUN BENCHMARK RESULTS'.padStart(45).padEnd(70) + '│')
  lines.push('├' + '─'.repeat(70) + '┤')

  // Match results by similar names
  const pairs: { name: string; node?: BenchmarkResult; bun?: BenchmarkResult }[] = []

  nodeResults.forEach(nr => {
    const baseName = nr.name.replace(/\s*\(.*\)/, '').toLowerCase()
    pairs.push({ name: nr.name, node: nr })
  })

  bunResults.forEach(br => {
    const baseName = br.name.replace(/\s*\(.*\)/, '').toLowerCase()
    const existing = pairs.find(p => p.name.toLowerCase().includes(baseName) || baseName.includes(p.name.toLowerCase()))
    if (existing) {
      existing.bun = br
    } else {
      pairs.push({ name: br.name, bun: br })
    }
  })

  pairs.forEach(pair => {
    lines.push('│' + ' '.repeat(70) + '│')
    lines.push('│  ' + pair.name.toUpperCase().padEnd(68) + '│')
    lines.push('│  ' + '─'.repeat(66) + '  │')

    const maxOps = Math.max(pair.node?.opsPerSecond || 0, pair.bun?.opsPerSecond || 0)

    if (pair.node) {
      const barLen = Math.round((pair.node.opsPerSecond / maxOps) * maxWidth)
      const bar = '█'.repeat(barLen) + '░'.repeat(maxWidth - barLen)
      lines.push(`│  Node.js: ${bar}  ${formatNumber(pair.node.opsPerSecond).padStart(10)} ops/s │`)
    }

    if (pair.bun) {
      const barLen = Math.round((pair.bun.opsPerSecond / maxOps) * maxWidth)
      const bar = '█'.repeat(barLen) + '░'.repeat(maxWidth - barLen)
      const speedup = pair.node ? `+${Math.round(((pair.bun.opsPerSecond / pair.node.opsPerSecond) - 1) * 100)}% faster` : ''
      lines.push(`│  Bun:     ${bar}  ${formatNumber(pair.bun.opsPerSecond).padStart(10)} ops/s │`)
      if (speedup) {
        lines.push(`│  ${speedup.padStart(68)}│`)
      }
    }
  })

  lines.push('│' + ' '.repeat(70) + '│')
  lines.push('└' + '─'.repeat(70) + '┘')

  return lines.join('\n')
}

/**
 * Generate a console-friendly summary
 */
export function generateConsoleSummary(results: BenchmarkResult[]): string {
  const lines: string[] = []

  lines.push('')
  lines.push('═'.repeat(60))
  lines.push('  BENCHMARK RESULTS')
  lines.push('═'.repeat(60))
  lines.push('')

  results.forEach(r => {
    lines.push(`  ${r.name}`)
    lines.push(`  ${'─'.repeat(r.name.length)}`)
    lines.push(`  Throughput:  ${formatNumber(r.opsPerSecond)} ops/sec`)
    lines.push(`  Avg Latency: ${formatLatency(r.avgLatencyMs)}`)
    lines.push(`  P50:         ${formatLatency(r.p50LatencyMs)}`)
    lines.push(`  P95:         ${formatLatency(r.p95LatencyMs)}`)
    lines.push(`  P99:         ${formatLatency(r.p99LatencyMs)}`)
    if (r.memoryUsedMB > 0) {
      lines.push(`  Memory:      ${formatMemory(r.memoryUsedMB)}`)
    }
    lines.push('')
  })

  lines.push('═'.repeat(60))
  lines.push('')

  return lines.join('\n')
}

/**
 * Load results from JSON file
 */
export function loadResults(filepath: string): ResultsFile | null {
  if (!existsSync(filepath)) return null
  try {
    const content = readFileSync(filepath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Generate a full markdown report
 */
export function generateMarkdownReport(results: BenchmarkResult[], title: string): string {
  const lines: string[] = []

  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(generateComparisonTable(results))
  lines.push('')
  lines.push('## Visual Comparison')
  lines.push('')
  lines.push('```')
  lines.push(generateAsciiChart(results))
  lines.push('```')
  lines.push('')
  lines.push('## Detailed Results')
  lines.push('')
  lines.push(generateMarkdownTable(results))
  lines.push('')

  return lines.join('\n')
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const resultsPath = join(process.cwd(), 'benchmarks/results/latest.json')
  const data = loadResults(resultsPath)

  if (data) {
    console.log(generateConsoleSummary(data.results))
    console.log('\nMarkdown Table:\n')
    console.log(generateMarkdownTable(data.results))
  } else {
    console.log('No benchmark results found. Run benchmarks first with: pnpm benchmark')
  }
}
