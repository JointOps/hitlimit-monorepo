# Contributing to hitlimit

## Setup

```bash
git clone https://github.com/hitlimit/hitlimit
cd hitlimit
pnpm install
```

## Development

```bash
pnpm build       # Build all packages
pnpm test        # Test all packages
pnpm test:node   # Test Node.js package only
pnpm test:bun    # Test Bun package only
pnpm clean       # Clean all dist folders
```

## Code Style

- No comments in code - code should be self-documenting
- Performance first - every line matters
- Clean, small functions
- Full TypeScript strict mode

## Pull Requests

1. Fork the repo
2. Create a feature branch
3. Make changes with tests
4. Submit PR

## Releasing

```bash
git tag v1.0.0
git push --tags
```

GitHub Actions will publish to npm automatically.
