# Node.js Benchmark Results

**Generated:** 2026-02-13T02:34:19.306Z
**Node.js:** v24.4.1
**Platform:** darwin arm64

## Store Support Matrix

| Library | Memory | SQLite | Redis |
|---------|--------|--------|-------|
| hitlimit | ✓ | ✓ | ✓ |
| express-rate-limit | ✓ | ✗ | ✗ |
| rate-limiter-flexible | ✓ | ✗ | ✓ |

## Memory Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 3.24M | 309ns | 292ns | 334ns | 458ns | **fastest** |
| hitlimit | 3.14M | 319ns | 292ns | 375ns | 542ns | 97% |
| express-rate-limit | 1.27M | 785ns | 708ns | 833ns | 1.42us | 39% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 2.54M | 394ns | 375ns | 541ns | 708ns | **fastest** |
| hitlimit | 2.48M | 403ns | 334ns | 541ns | 1.13us | 98% |
| express-rate-limit | 1.12M | 890ns | 791ns | 1.00us | 1.46us | 44% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 2.45M | 408ns | 334ns | 583ns | 791ns | **fastest** |
| rate-limiter-flexible | 1.84M | 543ns | 500ns | 792ns | 1.04us | 75% |
| express-rate-limit | 1.21M | 825ns | 750ns | 1.04us | 1.33us | 49% |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 462.0K | 2.16us | 2.08us | 2.25us | 2.46us | **fastest** |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 393.0K | 2.54us | 2.46us | 2.67us | 3.08us | **fastest** |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 390.4K | 2.56us | 2.50us | 2.75us | 3.17us | **fastest** |

