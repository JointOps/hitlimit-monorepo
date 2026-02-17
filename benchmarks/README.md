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
| **Memory** | single-ip | 4.19M | 239ns |
| **Memory** | 10k IPs | 3.35M | 299ns |
| **SQLite** | single-ip | 516K | 1.94μs |
| **SQLite** | 10k IPs | 428K | 2.33μs |
| **Redis** | single-ip | 6.6K | 152μs |
| **Redis** | 10k IPs | 6.4K | 157μs |

### Bun (hitlimit-bun)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 6.71M | 149ns |
| **Memory** | 10k IPs | 5.62M | 178ns |
| **bun:sqlite** | single-ip | 512K | 1.95μs |
| **bun:sqlite** | 10k IPs | 383K | 2.61μs |
| **Redis** | single-ip | 6.6K | 152μs |
| **Redis** | 10k IPs | 5.2K | 192μs |

### Comparison with Competitors (Memory Store, 10K IPs)

| Library | Ops/sec | vs Fastest |
|---------|---------|------------|
| **hitlimit** | **3.35M** | **fastest** |
| rate-limiter-flexible | 1.58M | 47% |
| express-rate-limit | 1.20M | 36% |

> hitlimit is the fastest in ALL memory scenarios — 1.26x on single-IP (4.19M vs 3.32M) and 2.1x on 10K IPs (3.35M vs 1.58M).

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

1. **Memory Store**: hitlimit is 2.1x faster than rate-limiter-flexible with many unique IPs (zero-allocation + sweep timer)
2. **SQLite Store**: Only hitlimit offers built-in SQLite (400-500K ops/sec)
3. **Redis Store**: Network-bound (~150μs latency), all libraries perform similarly
4. **Bun Runtime**: 1.5-2x faster than Node.js for memory operations
