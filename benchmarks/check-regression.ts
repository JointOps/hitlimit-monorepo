import fs from 'node:fs'
import path from 'node:path'

const resultsDir = path.resolve(new URL('.', import.meta.url).pathname, 'results')

interface ScenarioResult {
  opsPerSec: number
  [key: string]: any
}

interface BenchmarkResult {
  benchmark: { framework: string; library: string; store: string; runtime: string }
  scenarios: Record<string, ScenarioResult>
}

function parseSemver(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(Number)
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}

function compareFiles(oldFile: string, newFile: string): { regressions: number; improvements: number } {
  const oldData: BenchmarkResult = JSON.parse(fs.readFileSync(oldFile, 'utf-8'))
  const newData: BenchmarkResult = JSON.parse(fs.readFileSync(newFile, 'utf-8'))

  const label = `${newData.benchmark.runtime}-${newData.benchmark.framework}-${newData.benchmark.library}-${newData.benchmark.store}`
  let regressions = 0
  let improvements = 0

  for (const [scenario, newResult] of Object.entries(newData.scenarios)) {
    const oldResult = oldData.scenarios[scenario]
    if (!oldResult) continue

    const diff = ((newResult.opsPerSec - oldResult.opsPerSec) / oldResult.opsPerSec) * 100
    const diffStr = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`

    if (diff < -10) {
      console.log(`  REGRESSION  ${label} [${scenario}]: ${oldResult.opsPerSec.toLocaleString()} → ${newResult.opsPerSec.toLocaleString()} (${diffStr})`)
      regressions++
    } else if (diff > 10) {
      console.log(`  IMPROVED    ${label} [${scenario}]: ${oldResult.opsPerSec.toLocaleString()} → ${newResult.opsPerSec.toLocaleString()} (${diffStr})`)
      improvements++
    } else {
      console.log(`  OK          ${label} [${scenario}]: ${oldResult.opsPerSec.toLocaleString()} → ${newResult.opsPerSec.toLocaleString()} (${diffStr})`)
    }
  }

  return { regressions, improvements }
}

// Manual mode: compare two specific files
if (process.argv.length === 4) {
  const oldFile = process.argv[2]
  const newFile = process.argv[3]

  if (!fs.existsSync(oldFile) || !fs.existsSync(newFile)) {
    console.error('File not found')
    process.exit(1)
  }

  console.log(`\nComparing:\n  Old: ${oldFile}\n  New: ${newFile}\n`)
  const { regressions } = compareFiles(oldFile, newFile)
  process.exit(regressions > 0 ? 1 : 0)
}

// Auto mode: find two most recent version directories
if (!fs.existsSync(resultsDir)) {
  console.log('No results directory found')
  process.exit(0)
}

const versions = fs.readdirSync(resultsDir)
  .filter(d => d.startsWith('v') && fs.statSync(path.join(resultsDir, d)).isDirectory())
  .sort(compareSemver)

if (versions.length < 2) {
  console.log(`Only ${versions.length} version(s) found — need at least 2 to compare`)
  process.exit(0)
}

const oldVersion = versions[versions.length - 2]
const newVersion = versions[versions.length - 1]
const oldDir = path.join(resultsDir, oldVersion)
const newDir = path.join(resultsDir, newVersion)

console.log(`\nComparing ${oldVersion} → ${newVersion}\n`)

const newFiles = fs.readdirSync(newDir).filter(f => f.endsWith('.json'))
let totalRegressions = 0
let totalImprovements = 0
let compared = 0

for (const file of newFiles) {
  const oldFile = path.join(oldDir, file)
  const newFile = path.join(newDir, file)

  if (!fs.existsSync(oldFile)) {
    console.log(`  NEW         ${file} (no previous result)`)
    continue
  }

  const { regressions, improvements } = compareFiles(oldFile, newFile)
  totalRegressions += regressions
  totalImprovements += improvements
  compared++
}

console.log(`\n${compared} benchmarks compared: ${totalRegressions} regressions, ${totalImprovements} improvements`)

if (totalRegressions > 0) {
  console.log('\nFAILED — regressions detected')
  process.exit(1)
} else {
  console.log('\nPASSED — no regressions')
  process.exit(0)
}
