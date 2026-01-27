# Bun Benchmark Results

**Generated:** 2026-01-27T00:13:10.254Z
**Bun:** 1.3.1
**Platform:** darwin arm64

## Store Support Matrix

| Library | Memory | SQLite | Redis |
|---------|--------|--------|-------|
| hitlimit-bun | ✓ | ✓ | ✓ |

## Memory Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 9.05M | 110ns | 84ns | 125ns | 250ns |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 9.70M | 103ns | 84ns | 125ns | 208ns |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 9.11M | 110ns | 84ns | 167ns | 208ns |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 533.7K | 1.87us | 1.79us | 2.17us | 2.42us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 415.1K | 2.41us | 2.29us | 2.75us | 4.04us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 404.7K | 2.47us | 2.29us | 2.88us | 5.08us |

