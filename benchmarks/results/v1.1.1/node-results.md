# Node.js Benchmark Results

**Generated:** 2026-02-16T15:06:58.620Z
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
| hitlimit | 4.79M | 209ns | 208ns | 250ns | 334ns | **fastest** |
| rate-limiter-flexible | 3.30M | 303ns | 292ns | 334ns | 458ns | 69% |
| express-rate-limit | 1.14M | 879ns | 708ns | 917ns | 2.04us | 24% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 3.46M | 289ns | 250ns | 416ns | 667ns | **fastest** |
| rate-limiter-flexible | 1.98M | 505ns | 375ns | 750ns | 1.08us | 57% |
| express-rate-limit | 1.18M | 844ns | 750ns | 959ns | 1.38us | 34% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 3.26M | 307ns | 250ns | 500ns | 667ns | **fastest** |
| rate-limiter-flexible | 1.64M | 608ns | 542ns | 917ns | 1.21us | 50% |
| express-rate-limit | 1.17M | 852ns | 750ns | 1.21us | 1.83us | 36% |


## Sqlite Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 499.1K | 2.00us | 1.96us | 2.08us | 2.21us | **fastest** |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 418.0K | 2.39us | 2.33us | 2.50us | 2.75us | **fastest** |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 407.2K | 2.46us | 2.38us | 2.58us | 3.04us | **fastest** |


## Redis Store

### single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 6.6K | 152.28us | 145.04us | 183.54us | 287.67us | **fastest** |
| rate-limiter-flexible | 6.0K | 167.48us | 148.25us | 214.71us | 536.83us | 91% |

### multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 6.3K | 158.02us | 149.00us | 196.04us | 347.62us | **fastest** |
| hitlimit | 6.3K | 159.93us | 146.83us | 200.17us | 404.21us | 99% |

### multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 6.4K | 155.06us | 148.79us | 185.42us | 280.12us | **fastest** |
| hitlimit | 6.4K | 157.02us | 146.83us | 204.04us | 326.42us | 99% |

