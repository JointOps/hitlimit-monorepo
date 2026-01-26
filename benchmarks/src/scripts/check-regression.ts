/**
 * Check for performance regressions between benchmark runs
 *
 * Usage: tsx src/scripts/check-regression.ts [baseline.json] [current.json]
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const REGRESSION_THRESHOLD = 0.10  // 10% slower = regression
const IMPROVEMENT_THRESHOLD = 0.10 // 10% faster = improvement

interface Results {
  metadata: {
    nodeVersion?: string
    bunVersion?: string
    platform: string
    date: string
  }
  results: Array<{
    name: string
    scenario: string
    opsPerSec: number
  }>
}

function loadResults(path: string): Results | null {
  if (!existsSync(path)) {
    console.log(`File not found: ${path}`)
    return null
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`Failed to parse ${path}:`, error)
    return null
  }
}

function checkRegression(current: Results, baseline: Results, label: string): boolean {
  let hasRegression = false
  const comparisons: string[] = []

  for (const result of current.results) {
    // Only check hitlimit results
    if (!result.name.toLowerCase().includes('hitlimit')) continue

    const baselineResult = baseline.results.find(
      r => r.name === result.name && r.scenario === result.scenario
    )

    if (!baselineResult) {
      comparisons.push(`  [NEW] ${result.name} @ ${result.scenario}: ${result.opsPerSec.toLocaleString()} ops/sec`)
      continue
    }

    const change = (result.opsPerSec - baselineResult.opsPerSec) / baselineResult.opsPerSec

    if (change < -REGRESSION_THRESHOLD) {
      hasRegression = true
      comparisons.push(
        `  [REGRESSION] ${result.name} @ ${result.scenario}\n` +
        `    Baseline: ${baselineResult.opsPerSec.toLocaleString()} ops/sec\n` +
        `    Current:  ${result.opsPerSec.toLocaleString()} ops/sec\n` +
        `    Change:   ${(change * 100).toFixed(1)}%`
      )
    } else if (change > IMPROVEMENT_THRESHOLD) {
      comparisons.push(
        `  [IMPROVEMENT] ${result.name} @ ${result.scenario}: +${(change * 100).toFixed(1)}%`
      )
    } else {
      comparisons.push(
        `  [OK] ${result.name} @ ${result.scenario}: ${(change * 100).toFixed(1)}%`
      )
    }
  }

  if (comparisons.length > 0) {
    console.log(`\n${label}:`)
    console.log(comparisons.join('\n'))
  }

  return hasRegression
}

function main() {
  const args = process.argv.slice(2)

  let baselinePath: string
  let currentPath: string

  if (args.length >= 2) {
    baselinePath = args[0]
    currentPath = args[1]
  } else {
    // Default paths
    const resultsDir = join(__dirname, '..', '..', 'results')
    baselinePath = join(resultsDir, 'baseline.json')
    currentPath = join(resultsDir, 'latest.json')
  }

  console.log('Performance Regression Check')
  console.log('='.repeat(50))
  console.log(`Baseline: ${baselinePath}`)
  console.log(`Current:  ${currentPath}`)
  console.log(`Threshold: ${REGRESSION_THRESHOLD * 100}%`)

  const baseline = loadResults(baselinePath)
  const current = loadResults(currentPath)

  if (!baseline) {
    console.log('\nNo baseline found. Creating baseline from current results.')
    if (current && existsSync(currentPath)) {
      const fs = require('fs')
      fs.copyFileSync(currentPath, baselinePath)
      console.log(`Baseline saved to: ${baselinePath}`)
    }
    process.exit(0)
  }

  if (!current) {
    console.error('\nNo current results found. Run benchmarks first.')
    process.exit(1)
  }

  const hasRegression = checkRegression(current, baseline, 'Results')

  console.log('\n' + '='.repeat(50))

  if (hasRegression) {
    console.log('REGRESSION DETECTED')
    console.log('One or more benchmarks are >10% slower than baseline.')
    process.exit(1)
  } else {
    console.log('NO REGRESSIONS DETECTED')
    console.log('All benchmarks are within acceptable performance range.')
    process.exit(0)
  }
}

main()
