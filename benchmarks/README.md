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
| **Memory** | single-ip | 4.79M | 209ns |
| **Memory** | 10k IPs | 3.26M | 307ns |
| **SQLite** | single-ip | 499K | 2.00μs |
| **SQLite** | 10k IPs | 407K | 2.46μs |
| **Redis** | single-ip | 6.6K | 152μs |
| **Redis** | 10k IPs | 6.4K | 157μs |

### Bun (hitlimit-bun)

| Store | Scenario | Ops/sec | Avg Latency |
|-------|----------|---------|-------------|
| **Memory** | single-ip | 7.29M | 137ns |
| **Memory** | 10k IPs | 5.00M | 200ns |
| **bun:sqlite** | single-ip | 500K | 2.00μs |
| **bun:sqlite** | 10k IPs | 379K | 2.64μs |
| **Redis** | single-ip | 6.6K | 152μs |
| **Redis** | 10k IPs | 5.2K | 192μs |

### Comparison with Competitors (Memory Store, 10K IPs)

| Library | Ops/sec | vs Fastest |
|---------|---------|------------|
| **hitlimit** | **3.26M** | **fastest** |
| rate-limiter-flexible | 1.64M | 50% |
| express-rate-limit | 1.17M | 36% |

> hitlimit is now the fastest in ALL memory scenarios — 1.45x on single-IP (4.79M vs 3.30M) and 2x on 10K IPs.

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

1. **Memory Store**: hitlimit is 2x faster than rate-limiter-flexible with many unique IPs (sync fast path)
2. **SQLite Store**: Only hitlimit offers built-in SQLite (400-500K ops/sec)
3. **Redis Store**: Network-bound (~150μs latency), all libraries perform similarly
4. **Bun Runtime**: 1.5-2x faster than Node.js for memory operations
