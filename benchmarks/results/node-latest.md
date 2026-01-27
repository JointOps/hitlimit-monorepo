# Node.js Benchmark Results

**Generated:** 2026-01-27T00:13:02.468Z
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
| rate-limiter-flexible | 3.38M | 296ns | 291ns | 334ns | 458ns | **fastest** |
| hitlimit | 2.99M | 335ns | 333ns | 375ns | 459ns | 88% |
| express-rate-limit | 1.28M | 784ns | 667ns | 833ns | 1.33us | 38% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 2.55M | 392ns | 375ns | 541ns | 750ns | **fastest** |
| hitlimit | 2.42M | 412ns | 375ns | 542ns | 1.13us | 95% |
| express-rate-limit | 1.27M | 789ns | 750ns | 917ns | 1.29us | 50% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 2.34M | 427ns | 375ns | 583ns | 792ns | **fastest** |
| rate-limiter-flexible | 1.83M | 545ns | 500ns | 833ns | 1.04us | 78% |
| express-rate-limit | 1.04M | 961ns | 875ns | 1.33us | 1.83us | 45% |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 469.2K | 2.13us | 2.08us | 2.21us | 2.42us | **fastest** |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 406.3K | 2.46us | 2.42us | 2.58us | 2.83us | **fastest** |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 386.0K | 2.59us | 2.50us | 2.75us | 3.21us | **fastest** |

