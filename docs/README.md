# hitlimit Documentation Website

The official documentation site for hitlimit, built with [Astro](https://astro.build).

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Structure

```
docs/
├── public/              # Static assets (favicon, etc.)
├── src/
│   ├── components/      # Astro components
│   ├── data/
│   │   ├── benchmarks.json   # Single source of truth for ALL benchmark numbers
│   │   └── benchmarks.ts     # Formatting helpers (formatOps, formatLatency, etc.)
│   ├── layouts/         # Page layouts
│   ├── pages/           # File-based routing
│   │   ├── docs/        # Documentation pages
│   │   └── index.astro
│   └── styles/          # Global styles
├── astro.config.mjs
└── package.json
```

## Benchmark Data System

All benchmark numbers across the entire docs site come from a **single JSON file**. No page has hardcoded benchmark numbers — every ops/sec, latency, speedup ratio, and comparison is computed from this one file at build time.

### How it works

```
benchmarks/results/v1.4.0/*.json   ← raw benchmark outputs
        ↓
benchmarks/scripts/generate-benchmark-data.ts   ← generator script
        ↓
docs/src/data/benchmarks.json      ← single source of truth
        ↓
docs/src/data/benchmarks.ts        ← formatting helpers
        ↓
docs/src/**/*.astro                ← every doc page imports from here
```

### The data file: `src/data/benchmarks.json`

Contains all benchmark numbers organized by runtime and store:

```json
{
  "node": {
    "memory": {
      "singleIp": { "opsPerSec": 5412404, "latencyAvgNs": 185 },
      "multi1k":  { "opsPerSec": 3627222, "latencyAvgNs": 276 },
      "multi10k": { "opsPerSec": 3206714, "latencyAvgNs": 312, "memoryMB": 5.07 }
    },
    "sqlite": { ... },
    "redis": { ... },
    "postgres": { ... },
    "mongodb": { ... }
  },
  "bun": {
    "memory": { ... },
    "sqlite": { ... },
    "redis": { ... },
    "postgres": { ... }
  },
  "competitors": {
    "rateLimiterFlexible": { "memory": { ... }, "redis": { ... }, "postgres": { ... } },
    "expressRateLimit": { "memory": { ... } }
  },
  "httpOverhead": { ... },
  "bundleSize": { ... }
}
```

Each store has up to 3 scenarios:
- `singleIp` — one IP hitting the limiter repeatedly
- `multi1k` — 1,000 unique IPs
- `multi10k` — 10,000 unique IPs (most realistic for production)

### The helpers: `src/data/benchmarks.ts`

Formatting functions that every Astro page uses:

| Function | Example Input | Example Output |
|----------|--------------|----------------|
| `formatOps(n)` | `3206714` | `"3.21M"` |
| `formatOpsPlus(n)` | `3206714` | `"3.21M+"` |
| `formatOpsComma(n)` | `3206714` | `"3,206,714"` |
| `formatOpsCommaPlus(n)` | `3206714` | `"3,206,714+"` |
| `formatLatency(ns)` | `312` | `"312ns"` |
| `formatLatency(ns)` | `150000` | `"150μs"` |
| `formatLatencyApprox(ns)` | `312` | `"~312ns"` |
| `speedup(a, b)` | `3206714, 1202274` | `"2.7x"` |
| `pctOfFastest(val, max)` | `1202274, 3206714` | `"37%"` |
| `overheadPct(without, with)` | `65000, 61000` | `"~6%"` |
| `opsRange(lo, hi)` | `362981, 453811` | `"363-454K"` |
| `opsRangeDecimal(lo, hi)` | `6700, 6900` | `"6.7-6.9K"` |
| `toMillions(n)` | `3206714` | `3.21` |
| `formatReqSec(n)` | `45000` | `"45,000 req/s"` |

### Using benchmark data in Astro pages

Every page that shows benchmark numbers imports from the data layer:

```astro
---
import { bench, formatOps, formatLatency, speedup } from '../../data/benchmarks';
---

<!-- Use in HTML -->
<p>Memory store: {formatOps(bench.node.memory.singleIp.opsPerSec)} ops/sec</p>
<p>Latency: {formatLatency(bench.node.memory.singleIp.latencyAvgNs)}</p>
<p>hitlimit is {speedup(bench.node.memory.multi10k.opsPerSec, bench.competitors.rateLimiterFlexible.memory.multi10k.opsPerSec)} faster</p>

<!-- Use in meta descriptions -->
<DocsLayout
  description={`Achieves ${formatOps(bench.node.memory.multi10k.opsPerSec)} ops/sec`}
>
```

### Updating benchmark numbers

After re-running benchmarks, update the docs in one step:

```bash
# Option 1: Auto-generate from benchmark results
cd benchmarks
pnpm bench:update-docs

# Option 2: Edit the JSON directly
# Just edit docs/src/data/benchmarks.json

# Verify everything builds
cd docs
pnpm build
```

The generator script (`benchmarks/scripts/generate-benchmark-data.ts`):
1. Reads raw results from `benchmarks/results/v{latest}/`
2. Writes the structured JSON to `docs/src/data/benchmarks.json`
3. Updates README sections between `<!-- BENCH:xxx -->` markers

**That's it.** One file change, zero hunting through docs pages. Every number across all 51 pages updates automatically on the next build.

### README benchmark markers

Package READMEs can't import TypeScript, so they use HTML comment markers that the generator script fills in:

```markdown
<!-- BENCH:NODE_STORE_TABLE -->
| Store | Ops/sec | Latency |
|-------|---------|---------|
| Memory | 3,206,714+ | ~312ns |
...
<!-- /BENCH:NODE_STORE_TABLE -->
```

The generator script replaces content between matching `<!-- BENCH:xxx -->` / `<!-- /BENCH:xxx -->` pairs. Files with markers:
- `packages/hitlimit/README.md` — `NODE_HERO`, `NODE_STORE_TABLE`, `NODE_COMPETITOR_TABLE`
- `packages/hitlimit-bun/README.md` — `BUN_HERO`, `BUN_STORE_TABLE`, `BUN_VS_NODE_TABLE`, `BUN_VS_NODE_TEXT`
- `benchmarks/README.md` — `EXAMPLES`

### Adding a new store to the docs

1. Add benchmark data for the new store in `benchmarks.json` under the appropriate runtime
2. Reference it in Astro pages: `bench.node.newStore.multi10k.opsPerSec`
3. Add a README marker if needed
4. Run `pnpm build` in `docs/` to verify

### Adding a new formatting helper

Add the function to `src/data/benchmarks.ts`, then import it in any Astro page that needs it.

## Features

- Custom dark theme with Linear/Raycast inspired design
- Full-text search with Command+K modal
- Responsive sidebar with collapsible sections
- Table of contents with scroll spy
- Syntax highlighted code blocks
- Package manager tabs (npm, pnpm, yarn, bun)
- Centralized benchmark data — single JSON file drives all numbers site-wide

## License

MIT
