# Benchmark Results

**Generated:** 2026-01-26T23:56:41.972Z
**Node.js:** v24.4.1  
**Platform:** darwin arm64


---

## single-ip

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 3.37M | 297ns | 250ns | 334ns | 1.25us | 1st |
| hitlimit | 2.95M | 339ns | 292ns | 375ns | 500ns | 87% |
| hitlimit (tiered) | 2.27M | 440ns | 417ns | 500ns | 584ns | 67% |
| express-rate-limit | 1.35M | 740ns | 667ns | 792ns | 1.13us | 40% |

## multi-ip-1k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| rate-limiter-flexible | 2.61M | 382ns | 375ns | 500ns | 667ns | 1st |
| hitlimit | 2.52M | 397ns | 375ns | 500ns | 666ns | 96% |
| hitlimit (tiered) | 1.98M | 506ns | 500ns | 583ns | 792ns | 76% |
| express-rate-limit | 1.25M | 803ns | 709ns | 958ns | 1.33us | 48% |

## multi-ip-10k

| Library | ops/sec | avg | p50 | p95 | p99 | vs fastest |
|---------|---------|-----|-----|-----|-----|------------|
| hitlimit | 2.57M | 389ns | 375ns | 542ns | 750ns | 1st |
| rate-limiter-flexible | 1.98M | 506ns | 458ns | 750ns | 959ns | 77% |
| hitlimit (tiered) | 1.94M | 514ns | 458ns | 709ns | 917ns | 76% |
| express-rate-limit | 1.23M | 814ns | 750ns | 1.00us | 1.25us | 48% |

## Summary

- hitlimit wins 4/6 comparisons
- Average memory usage: 7.25 MB
