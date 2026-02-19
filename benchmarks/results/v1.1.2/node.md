# Node.js Benchmark Results

**Generated:** 2026-02-16T22:24:05.919Z
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
| hitlimit | 4.19M | 239ns | 250ns | 292ns | 375ns | **fastest** |
| rate-limiter-flexible | 3.32M | 301ns | 292ns | 334ns | 458ns | 79% |
| express-rate-limit | 1.30M | 767ns | 667ns | 833ns | 1.25us | 31% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 3.51M | 285ns | 291ns | 334ns | 459ns | **fastest** |
| rate-limiter-flexible | 2.47M | 405ns | 375ns | 583ns | 792ns | 70% |
| express-rate-limit | 1.16M | 865ns | 709ns | 959ns | 1.92us | 33% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 3.35M | 299ns | 291ns | 417ns | 584ns | **fastest** |
| rate-limiter-flexible | 1.58M | 633ns | 542ns | 916ns | 1.42us | 47% |
| express-rate-limit | 1.20M | 833ns | 750ns | 1.04us | 1.46us | 36% |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 516.5K | 1.94us | 1.92us | 2.04us | 2.17us | **fastest** |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 434.2K | 2.30us | 2.29us | 2.42us | 2.54us | **fastest** |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 428.3K | 2.33us | 2.29us | 2.46us | 2.83us | **fastest** |

