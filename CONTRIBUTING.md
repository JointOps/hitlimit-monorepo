# Contributing to hitlimit

Thank you for your interest in contributing to hitlimit! This guide will help you get started.

## Prerequisites

Before you begin, make sure you have the following installed:

| Tool | Minimum Version | Installation |
|------|-----------------|--------------|
| **Node.js** | 18.0.0 | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| **pnpm** | 8.0.0 | `npm install -g pnpm` or `corepack enable` |
| **Bun** | 1.0.0 | [bun.sh](https://bun.sh) or `curl -fsSL https://bun.sh/install \| bash` |

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/JointOps/hitlimit-monorepo
cd hitlimit-monorepo
```

### 2. Run the setup script

```bash
npx tsx scripts/setup.ts
```

The setup script will:
- Verify all prerequisites are installed
- Provide helpful error messages if anything is missing
- Install Node.js dependencies (pnpm)
- Install Bun dependencies (bun)
- Build all packages
- Run tests to verify everything works

### 3. Start developing!

You're all set. See the commands below for common development tasks.

## Project Structure

```
hitlimit-monorepo/
├── packages/
│   ├── types/           # @joint-ops/hitlimit-types - Shared TypeScript types
│   ├── hitlimit/        # hitlimit - Node.js rate limiter
│   └── hitlimit-bun/    # hitlimit-bun - Bun rate limiter
├── docs/                # Documentation site (Astro)
├── benchmarks/          # Performance benchmarks
└── scripts/             # Build, test, and release scripts
```

## Development Commands

### All Packages

```bash
pnpm test              # Run all tests
pnpm build             # Build all packages
pnpm clean             # Clean all build artifacts
pnpm typecheck         # Run TypeScript type checking
```

### Node.js Packages Only

```bash
pnpm test:node         # Test @joint-ops/hitlimit-types and hitlimit
pnpm build:node        # Build @joint-ops/hitlimit-types and hitlimit
```

### Bun Package Only

```bash
pnpm test:bun          # Test hitlimit-bun
pnpm build:bun         # Build hitlimit-bun
```

### Documentation

```bash
pnpm docs:dev          # Start docs dev server at localhost:4321
pnpm docs:build        # Build docs for production
pnpm docs:preview      # Preview production build
```

### Benchmarks

```bash
pnpm benchmark         # Run Node.js benchmarks (memory/sqlite)
pnpm benchmark:memory  # Memory store only
pnpm benchmark:all     # Run ALL benchmarks (requires Docker for Redis/Postgres)
```

## Hybrid Package Manager Architecture

This monorepo uses a **hybrid architecture**:

- **Node.js packages** (`@joint-ops/hitlimit-types`, `hitlimit`, `docs`, `benchmarks`) use **pnpm**
- **Bun package** (`hitlimit-bun`) uses **bun** natively

This allows each runtime to use its optimal tooling:
- pnpm for Node.js workspaces and dependencies
- Bun for native bun:sqlite and Bun-specific optimizations

## Code Style

- No comments in code - code should be self-documenting
- Performance first - every line matters
- Clean, small functions
- Full TypeScript strict mode
- ESM only (`import`/`export`)

## Making Changes

### 1. Create a branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/my-bugfix
```

### 2. Make your changes

- Follow the existing code style
- Add tests for new functionality
- Update documentation if needed

### 3. Run tests

```bash
pnpm test
```

### 4. Create a pull request

- Use a clear, descriptive title
- Reference any related issues
- Describe what changes you made and why

## Testing

We use **Vitest** for Node.js packages and **Bun's built-in test runner** for hitlimit-bun.

### Run all tests (Node.js + Bun)

```bash
pnpm test                # Runs ./scripts/test-all.sh
```

### Run tests by runtime

```bash
pnpm test:node           # Node.js only (types + hitlimit via Vitest)
pnpm test:bun            # Bun only (hitlimit-bun via bun test)
```

### Run a single test file

```bash
# Node.js (Vitest)
cd packages/hitlimit
pnpm vitest run test/stores/redis.test.ts

# Bun
cd packages/hitlimit-bun
bun test test/stores/memory.test.ts
```

### Test structure

```
packages/hitlimit/test/
├── core/           # limiter, config, headers, response, utils
├── stores/         # memory, sqlite, redis, valkey, dragonfly, postgres, mongodb, mysql
├── adapters/       # express, fastify, hono, node, nest
├── integration/    # performance, tiered, concurrency, error-handling, store-errors
└── loggers/        # logger tests

packages/hitlimit-bun/test/
├── core/           # limiter, config, headers, response, utils
├── stores/         # memory, sqlite, redis, valkey, dragonfly, postgres, mongodb, mysql
├── adapters/       # bun-serve, elysia, hono
├── integration/    # performance, tiered, concurrency, error-handling, store-errors
└── loggers/        # logger tests
```

### Notes on store tests

- **Memory, SQLite, MongoDB, MySQL, Postgres** tests run with mocks locally — no services needed
- **Redis, Valkey, DragonflyDB** tests attempt a real connection; they'll log ioredis errors locally if the service isn't running, but tests still pass (they mock the connection failure)
- **CI** runs all store tests with real services via Docker (Redis, Postgres, Valkey, DragonflyDB, MongoDB, MySQL)

## Benchmarks

Benchmarks live in the `benchmarks/` directory, organized by runtime and framework.

### Quick benchmarks (no Docker needed)

```bash
pnpm benchmark             # Node.js memory/sqlite benchmarks
pnpm benchmark:memory      # Memory store only
```

### Full benchmarks (requires Docker)

```bash
# Run all benchmarks (Docker services start/stop automatically per store)
pnpm benchmark:all                         # Full suite

# Interactive CLI with all options
pnpm benchmark:cli                         # Interactive menu
npx tsx benchmarks/cli.ts store redis      # Specific store only
npx tsx benchmarks/cli.ts quick            # Memory + SQLite (no Docker)
npx tsx benchmarks/cli.ts status           # View existing results
npx tsx benchmarks/cli.ts compare          # Regression check
```

### Updating docs after benchmarks

All benchmark numbers across the docs site and READMEs are driven by a single JSON file. After running benchmarks:

```bash
cd benchmarks
pnpm bench:update-docs     # Auto-generates docs/src/data/benchmarks.json + updates READMEs
cd ../docs
pnpm build                 # Verify all 51 pages build with the new numbers
```

See [`docs/README.md`](docs/README.md#benchmark-data-system) for full details on how the benchmark data system works.

### Benchmark structure

```
benchmarks/
├── cli.ts                 # Interactive benchmark CLI
├── node/
│   ├── store/              # Raw store benchmarks (hitlimit vs rate-limiter-flexible)
│   ├── express/            # Express middleware (hitlimit vs express-rate-limit vs rate-limiter-flexible)
│   ├── fastify/            # Fastify plugin (hitlimit vs @fastify/rate-limit)
│   ├── hono/               # Hono middleware (hitlimit vs hono-rate-limiter)
│   └── nestjs/             # NestJS guard (hitlimit vs @nestjs/throttler)
├── bun/
│   ├── store/              # Raw store benchmarks
│   ├── bun-serve/          # Bun.serve benchmarks
│   ├── elysia/             # Elysia plugin (hitlimit vs elysia-rate-limit)
│   └── hono/               # Hono on Bun (hitlimit vs hono-rate-limiter)
├── lib/                    # Shared benchmark runner, scenarios, types
└── results/                # Saved benchmark results
```

Each benchmark tests across stores: memory, sqlite, redis, valkey, dragonfly, postgres, mongodb, mysql.

## Releasing

Releases are handled by maintainers:

```bash
# 1. Update VERSION file (CI validates tag matches this)
echo "1.4.0" > VERSION

# 2. Bump all package versions
./scripts/bump-version.sh

# 3. Commit
git add VERSION packages/*/package.json
git commit -m "chore: bump version to 1.4.0"

# 4. Release
./scripts/release.sh
```

The release script will:
- Verify all tests pass
- Build all packages
- Publish to npm
- Create a git tag

**Important**: Always update the `VERSION` file first — CI validates the git tag matches it.

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/JointOps/hitlimit-monorepo/discussions)
- **Bugs**: Open an [Issue](https://github.com/JointOps/hitlimit-monorepo/issues)

## License

By contributing to hitlimit, you agree that your contributions will be licensed under its MIT license.
