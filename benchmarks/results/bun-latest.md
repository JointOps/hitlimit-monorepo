# Bun Benchmark Results

**Generated:** 2026-01-27T00:07:35.312Z
**Bun:** 1.3.1
**Platform:** darwin arm64

## single-ip

| Library | Store | ops/sec | avg | p95 | p99 |
|---------|-------|---------|-----|-----|-----|
| hitlimit-bun (memory) | memory | 10.99M | 91ns | 125ns | 208ns |
| hitlimit-bun (sqlite) | sqlite | 508.6K | 1.97us | 2.29us | 3.25us |

## multi-ip-1k

| Library | Store | ops/sec | avg | p95 | p99 |
|---------|-------|---------|-----|-----|-----|
| hitlimit-bun (memory) | memory | 9.82M | 102ns | 166ns | 208ns |
| hitlimit-bun (sqlite) | sqlite | 384.7K | 2.60us | 2.96us | 4.54us |

## multi-ip-10k

| Library | Store | ops/sec | avg | p95 | p99 |
|---------|-------|---------|-----|-----|-----|
| hitlimit-bun (memory) | memory | 9.62M | 104ns | 166ns | 208ns |
| hitlimit-bun (sqlite) | sqlite | 374.1K | 2.67us | 3.21us | 6.17us |

