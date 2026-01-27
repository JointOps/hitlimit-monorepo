# Bun Benchmark Results

**Generated:** 2026-01-27T00:59:50.423Z
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
| hitlimit-bun | 7.21M | 139ns | 125ns | 167ns | 209ns |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.34M | 158ns | 125ns | 209ns | 250ns |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.10M | 164ns | 166ns | 209ns | 250ns |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 519.9K | 1.92us | 1.88us | 2.21us | 2.38us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 397.9K | 2.51us | 2.38us | 2.88us | 4.21us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 386.7K | 2.59us | 2.42us | 2.96us | 5.04us |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.9K | 145.55us | 140.58us | 172.25us | 393.04us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.8K | 147.08us | 141.83us | 172.79us | 376.08us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 5.4K | 186.68us | 145.38us | 302.75us | 447.13us |

