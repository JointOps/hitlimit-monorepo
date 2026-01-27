# Bun Benchmark Results

**Generated:** 2026-01-27T00:25:21.005Z
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
| hitlimit-bun | 4.40M | 227ns | 208ns | 334ns | 500ns |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.07M | 165ns | 166ns | 209ns | 292ns |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 5.77M | 173ns | 167ns | 250ns | 334ns |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 493.1K | 2.03us | 1.96us | 2.38us | 2.75us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 408.8K | 2.45us | 2.33us | 2.79us | 3.92us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 383.5K | 2.61us | 2.46us | 3.04us | 5.00us |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 6.8K | 147.16us | 141.46us | 168.04us | 383.08us |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 7.1K | 141.73us | 138.33us | 162.79us | 362.13us |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 |
|---------|---------|-----|-----|-----|-----|
| hitlimit-bun | 5.4K | 183.69us | 143.29us | 294.29us | 428.08us |

