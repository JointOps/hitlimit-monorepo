export interface ScenarioConfig {
  name: string
  description: string
  keys: string[]
}

export interface BenchmarkConfig {
  warmupIterations: number
  iterations: number
  runs: number
}

export interface ScenarioResult {
  description: string
  keys: number
  opsPerSec: number
  latency: {
    avgNs: number
    p50Ns: number
    p95Ns: number
    p99Ns: number
    minNs: number
    maxNs: number
  }
  stdDev: number
  marginOfError: number
  memoryMB: number
}

export interface BenchmarkOutput {
  benchmark: {
    framework: string
    library: string
    store: string
    runtime: string
  }
  environment: {
    runtimeVersion: string
    os: string
    arch: string
    cpu: string
    cpuCores: number
    memoryGB: number
    docker: boolean
  }
  versions: Record<string, string>
  config: BenchmarkConfig
  date: string
  scenarios: Record<string, ScenarioResult>
}
