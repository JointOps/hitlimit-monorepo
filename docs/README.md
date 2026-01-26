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
├── public/           # Static assets (favicon, etc.)
├── src/
│   ├── components/   # Astro components
│   ├── layouts/      # Page layouts
│   ├── pages/        # File-based routing
│   │   ├── docs/     # Documentation pages
│   │   └── index.astro
│   └── styles/       # Global styles
├── astro.config.mjs
└── package.json
```

## Features

- Custom dark theme with Linear/Raycast inspired design
- Full-text search with Command+K modal
- Responsive sidebar with collapsible sections
- Table of contents with scroll spy
- Syntax highlighted code blocks
- Package manager tabs (npm, pnpm, yarn, bun)

## License

MIT
