# Claude Code Instructions

## Commit Guidelines

- Do NOT add "Co-Authored-By: Claude" or any similar co-author attribution to commits
- Keep commit messages concise and focused on what changed

## Project Context

This is the hitlimit monorepo - a fast rate limiting library for Node.js and Bun.

### Package Structure

- `packages/types` - Shared TypeScript types (@hitlimit/types)
- `packages/hitlimit` - Node.js rate limiter (Express, NestJS, Node HTTP)
- `packages/hitlimit-bun` - Bun rate limiter (Bun.serve, Elysia)
- `docs/` - Astro documentation site
- `benchmarks/` - Performance benchmarks

### Development Commands

```bash
pnpm install          # Install Node.js dependencies
bun install           # Install Bun dependencies (in packages/hitlimit-bun)
pnpm test             # Run all tests
pnpm build            # Build all packages
pnpm docs:dev         # Start docs dev server
```

### Testing

- Node.js tests use Vitest
- Bun tests use bun:test
- Run `./scripts/test-all.sh` for full test suite
