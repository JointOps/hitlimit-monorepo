/**
 * Bun Benchmark Suite Runner
 *
 * Runs all Bun-specific benchmarks and generates a report.
 * Run with: bun benchmarks/bun/index.ts
 */

import { spawn } from 'bun'
import { join } from 'path'

const benchmarks = [
  { name: 'Memory Store', file: 'memory.bench.ts' },
  { name: 'SQLite Store (bun:sqlite)', file: 'sqlite.bench.ts' }
]

// Optional benchmarks that require external services
const optionalBenchmarks = [
  { name: 'Redis Store', file: 'redis.bench.ts', env: 'REDIS_URL' }
]

async function runBenchmark(file: string): Promise<string> {
  const proc = spawn({
    cmd: ['bun', join(import.meta.dir, file)],
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env
  })

  const output = await new Response(proc.stdout).text()
  await proc.exited

  return output
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  BUN BENCHMARK SUITE                          ║
║                                                               ║
║   hitlimit-bun: Native rate limiting for Bun                  ║
╚══════════════════════════════════════════════════════════════╝
`)

  console.log(`Bun Version: ${Bun.version}`)
  console.log(`Platform: ${process.platform} ${process.arch}`)
  console.log('')

  // Run core benchmarks
  for (const bench of benchmarks) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  Running: ${bench.name}`)
    console.log(`${'═'.repeat(60)}\n`)

    try {
      const output = await runBenchmark(bench.file)
      console.log(output)
    } catch (error: any) {
      console.log(`  Failed: ${error.message}`)
    }
  }

  // Run optional benchmarks
  for (const bench of optionalBenchmarks) {
    if (process.env[bench.env]) {
      console.log(`\n${'═'.repeat(60)}`)
      console.log(`  Running: ${bench.name}`)
      console.log(`${'═'.repeat(60)}\n`)

      try {
        const output = await runBenchmark(bench.file)
        console.log(output)
      } catch (error: any) {
        console.log(`  Failed: ${error.message}`)
      }
    } else {
      console.log(`\n  Skipping ${bench.name}: Set ${bench.env} to enable`)
    }
  }

  console.log(`
${'═'.repeat(60)}
  BENCHMARK COMPLETE
${'═'.repeat(60)}

To run HTTP throughput benchmarks:
  bun benchmarks/http/bun-serve.bench.ts
  bun benchmarks/http/elysia.bench.ts

Then in another terminal:
  autocannon -c 100 -d 10 http://localhost:3001
`)
}

main().catch(console.error)
