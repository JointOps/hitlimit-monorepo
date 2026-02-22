import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { scenarios } from './scenarios.js'
import type { BenchmarkConfig, BenchmarkOutput, ScenarioResult } from './types.js'

export interface RunOptions {
  framework: string
  library: string
  store: string
  runtime: 'node' | 'bun'
  versions: Record<string, string>
  fn: (key: string) => any
  isSync: boolean
  cleanup?: () => void | Promise<void>
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const CONFIG: BenchmarkConfig = {
  warmupIterations: 5000,
  iterations: 50000,
  runs: 5
}

function now(): number {
  if (typeof (globalThis as any).Bun !== 'undefined') {
    return (globalThis as any).Bun.nanoseconds()
  }
  return Number(process.hrtime.bigint())
}

function forceGC(): void {
  if (typeof (globalThis as any).Bun !== 'undefined') {
    (globalThis as any).Bun.gc(true)
  } else {
    (globalThis as any).gc?.()
  }
}

function getOSString(): string {
  const platform = os.platform()
  if (platform === 'darwin') {
    try {
      const version = execSync('/usr/bin/sw_vers -productVersion', { encoding: 'utf-8' }).trim()
      return `macOS ${version}`
    } catch {
      return `darwin ${os.release()}`
    }
  }
  if (platform === 'linux') return `Linux ${os.release()}`
  if (platform === 'win32') return `Windows ${os.release()}`
  return `${platform} ${os.release()}`
}

function detectDocker(): boolean {
  try {
    fs.accessSync('/.dockerenv')
    return true
  } catch {
    return false
  }
}

function getRuntimeVersion(): string {
  if (typeof (globalThis as any).Bun !== 'undefined') {
    return (globalThis as any).Bun.version
  }
  return process.version
}

function calcStats(latencies: Float64Array, count: number): Omit<ScenarioResult, 'description' | 'keys' | 'memoryMB'> {
  const sorted = Array.from(latencies.subarray(0, count)).sort((a, b) => a - b)
  const n = sorted.length

  let sum = 0
  for (let i = 0; i < n; i++) sum += sorted[i]
  const avg = sum / n

  let varianceSum = 0
  for (let i = 0; i < n; i++) {
    const diff = sorted[i] - avg
    varianceSum += diff * diff
  }
  const stdDev = Math.sqrt(varianceSum / n)

  const totalNs = sum
  const opsPerSec = Math.round(n / (totalNs / 1e9))

  return {
    opsPerSec,
    latency: {
      avgNs: Math.round(avg),
      p50Ns: Math.round(sorted[Math.floor(n * 0.50)]),
      p95Ns: Math.round(sorted[Math.floor(n * 0.95)]),
      p99Ns: Math.round(sorted[Math.floor(n * 0.99)]),
      minNs: Math.round(sorted[0]),
      maxNs: Math.round(sorted[n - 1])
    },
    stdDev: Math.round(stdDev * 100) / 100,
    marginOfError: Math.round((1.96 * stdDev / Math.sqrt(n)) * 100) / 100
  }
}

export async function run(opts: RunOptions): Promise<void> {
  const { framework, library, store, runtime, versions, fn, isSync, cleanup } = opts
  const { warmupIterations, iterations, runs } = CONFIG

  const benchmarksDir = path.resolve(new URL('.', import.meta.url).pathname, '..')
  const version = fs.readFileSync(path.resolve(benchmarksDir, '..', 'VERSION'), 'utf-8').trim()

  const environment = {
    runtimeVersion: getRuntimeVersion(),
    os: getOSString(),
    arch: os.arch(),
    cpu: os.cpus()[0].model,
    cpuCores: os.cpus().length,
    memoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
    docker: detectDocker()
  }

  const scenarioResults: Record<string, ScenarioResult> = {}

  console.log(`\n${library} | ${store} | ${framework} | ${runtime}`)
  console.log('─'.repeat(50))

  for (let s = 0; s < scenarios.length; s++) {
    const scenario = scenarios[s]
    const keys = scenario.keys
    const keyCount = keys.length

    if (s > 0) await sleep(500)

    // Warmup — NOT timed
    if (isSync) {
      for (let i = 0; i < warmupIterations; i++) {
        fn(keys[i % keyCount])
      }
    } else {
      for (let i = 0; i < warmupIterations; i++) {
        await fn(keys[i % keyCount])
      }
    }

    forceGC()
    const memBefore = process.memoryUsage().heapUsed

    const totalMeasured = iterations * runs
    const latencies = new Float64Array(totalMeasured)
    let latencyIndex = 0

    for (let r = 0; r < runs; r++) {
      forceGC()
      if (r > 0) await sleep(200)

      if (isSync) {
        for (let i = 0; i < iterations; i++) {
          const key = keys[i % keyCount]
          const start = now()
          fn(key)
          const end = now()
          latencies[latencyIndex++] = end - start
        }
      } else {
        for (let i = 0; i < iterations; i++) {
          const key = keys[i % keyCount]
          const start = now()
          await fn(key)
          const end = now()
          latencies[latencyIndex++] = end - start
        }
      }
    }

    const memAfter = process.memoryUsage().heapUsed
    const memoryMB = Math.round(((memAfter - memBefore) / 1024 / 1024) * 100) / 100

    const stats = calcStats(latencies, totalMeasured)
    scenarioResults[scenario.name] = {
      description: scenario.description,
      keys: keyCount,
      memoryMB: Math.max(0, memoryMB),
      ...stats
    }

    console.log(`  ${scenario.name}: ${stats.opsPerSec.toLocaleString()} ops/sec (avg ${stats.latency.avgNs}ns, p99 ${stats.latency.p99Ns}ns)`)
  }

  const output: BenchmarkOutput = {
    benchmark: { framework, library, store, runtime },
    environment,
    versions,
    config: { ...CONFIG, totalMeasured: iterations * runs } as any,
    date: new Date().toISOString(),
    scenarios: scenarioResults
  }

  const resultsDir = path.resolve(benchmarksDir, 'results', `v${version}`)
  fs.mkdirSync(resultsDir, { recursive: true })

  const filename = `${runtime}-${framework}-${library}-${store}.json`
  const filepath = path.resolve(resultsDir, filename)
  fs.writeFileSync(filepath, JSON.stringify(output, null, 2) + '\n')

  console.log(`\n  → ${filepath}\n`)

  if (cleanup) await cleanup()
}
