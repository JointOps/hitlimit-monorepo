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
pnpm benchmark         # Run Node.js benchmarks
pnpm benchmark:bun     # Run Bun benchmarks
pnpm benchmark:all     # Run all benchmarks
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

We use:
- **Vitest** for Node.js packages
- **Bun's built-in test runner** for hitlimit-bun

Run tests with:
```bash
pnpm test
```

## Releasing

Releases are handled by maintainers:

```bash
# 1. Update VERSION file
echo "1.0.1" > VERSION

# 2. Bump all package versions
./scripts/bump-version.sh

# 3. Commit
git add . && git commit -m "chore: bump version to 1.0.1"

# 4. Release
./scripts/release.sh
```

The release script will:
- Verify all tests pass
- Build all packages
- Publish to npm
- Create a git tag

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/JointOps/hitlimit-monorepo/discussions)
- **Bugs**: Open an [Issue](https://github.com/JointOps/hitlimit-monorepo/issues)

## License

By contributing to hitlimit, you agree that your contributions will be licensed under its MIT license.
