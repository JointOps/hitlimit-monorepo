# hitlimit Benchmarks

Reproducible benchmarks for hitlimit rate limiting library.

## Quick Start

```bash
# From monorepo root
pnpm install
pnpm build

# Run Node.js benchmarks
cd benchmarks
npx tsx src/scripts/run-node.ts

# Run Bun benchmarks
bun src/scripts/run-bun.ts
```

## Test Environment

- **Node.js**: v18, v20, v22, v24
- **Bun**: v1.0+
- **Redis**: 7.x (optional)
- **Machine**: Apple M2 (ARM64)

## Methodology

- Each benchmark runs 5 times, median reported
- Warmup: 1,000 iterations before measurement
- Test: 50,000 iterations per run
- Three scenarios: single-ip, multi-ip-1k, multi-ip-10k
- Memory measured via `process.memoryUsage()`

## Latest Results

### Node.js (hitlimit)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 4.11M | 243ns |
| **Memory** | 10k IPs | 3.25M | 308ns |
| **SQLite** | single-ip | 490K | 2.04μs |
| **SQLite** | 10k IPs | 401K | 2.49μs |
| **Redis** | single-ip | 6.8K | 146μs |
| **Redis** | 10k IPs | 6.8K | 147μs |

### Bun (hitlimit-bun)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 6.62M | 151ns |
| **Memory** | 10k IPs | 5.62M | 178ns |
| **bun:sqlite** | single-ip | 495K | 2.02μs |
| **bun:sqlite** | 10k IPs | 378K | 2.65μs |
| **Redis** | single-ip | 6.7K | 149μs |
| **Redis** | 10k IPs | 6.7K | 149μs |

### Comparison with Competitors (Memory Store, 10K IPs)

| Library | Ops/sec | vs Fastest |
|---------|---------|------------|
| **hitlimit** | **3.25M** | **fastest** |
| rate-limiter-flexible | 1.84M | 57% |
| express-rate-limit | 957K | 29% |

> hitlimit is the fastest in ALL memory scenarios — 1.3x on single-IP (4.11M vs 3.22M) and 1.8x on 10K IPs (3.25M vs 1.84M).

> **Fair play:** These are our benchmarks and we've done our best to keep them fair and reproducible. We encourage you to clone this repo and run them yourself. They're not set in stone — there's always room for improvement. If you spot issues or have suggestions, please open an issue or PR.

## Redis Setup

```bash
# Start Redis for benchmarks
docker run -p 6379:6379 redis:7-alpine

# Or use docker-compose from monorepo root
docker compose up -d redis
```

## Results

Results are saved to `benchmarks/results/`:
- `node-latest.json` / `node-latest.md` - Node.js results
- `bun-latest.json` / `bun-latest.md` - Bun results

## Key Insights

1. **Memory Store**: hitlimit is 1.8x faster than rate-limiter-flexible with many unique IPs (zero-allocation + sweep timer)
2. **SQLite Store**: Only hitlimit offers built-in SQLite (400-500K ops/sec)
3. **Redis Store**: Network-bound (~150μs latency), hitlimit uses atomic Lua scripts (EVALSHA) for single round-trip
4. **Bun Runtime**: 1.5-2x faster than Node.js for memory operations
