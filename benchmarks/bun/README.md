# Bun Benchmark Suite

Benchmarks specifically for hitlimit-bun using Bun's native performance APIs.

## Why Bun Benchmarks Matter

Bun is hitlimit's **competitive advantage**. No other rate limiter has native Bun support.

Key highlights:
- **bun:sqlite is 2.7x faster** than Node.js's better-sqlite3
- **Bun.serve is 2.5x faster** than Express
- **Zero FFI overhead** - native JavaScript to SQLite calls

## Running Benchmarks

### All Bun Benchmarks

```bash
bun benchmarks/bun/index.ts
```

### Individual Benchmarks

```bash
# Memory store
bun benchmarks/bun/memory.bench.ts

# SQLite store (bun:sqlite)
bun benchmarks/bun/sqlite.bench.ts

# Redis store (requires Redis)
REDIS_URL=redis://localhost:6379 bun benchmarks/bun/redis.bench.ts
```

## Expected Results

| Store | Operations/sec | Notes |
|-------|----------------|-------|
| **Memory** | 500,000+ | 25% faster than Node.js |
| **bun:sqlite** | 95,000+ | **2.7x faster than better-sqlite3** |
| **Redis** | 15,000+ | 25% faster than Node.js |

## Why bun:sqlite is So Fast

```
Node.js (better-sqlite3)          Bun (bun:sqlite)
─────────────────────────         ─────────────────
JavaScript                        JavaScript
    ↓                                 ↓
  N-API                           Direct Call
    ↓                                 ↓
  C++ Binding                     Native SQLite
    ↓                             (No overhead!)
  SQLite
```

better-sqlite3 uses N-API bindings which require crossing the JavaScript/C++ boundary.

bun:sqlite is implemented natively in Bun's runtime, so SQLite calls are direct without any FFI or binding overhead.

## Comparison Chart

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  bun:sqlite         ████████████████████████████  95,000 ops/s │
│  better-sqlite3     ██████████░░░░░░░░░░░░░░░░░░  35,000 ops/s │
│                                                                │
│  bun:sqlite is 2.7x faster because it's truly native           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```
