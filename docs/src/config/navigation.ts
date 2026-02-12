/**
 * Documentation Navigation Configuration
 *
 * This file defines the sidebar structure and provides utilities
 * for navigating between documentation pages.
 */

export interface NavItem {
  label: string;
  href: string;
}

export interface SubSection {
  title: string;
  items: NavItem[];
}

export interface NavSection {
  title: string;
  icon: string;
  items?: NavItem[];
  subsections?: SubSection[];
}

/**
 * Documentation sidebar structure
 *
 * Order is optimized for user journey:
 * 1. Getting Started - New users start here
 * 2. Adapters (Node.js) - Most common use case
 * 3. Configuration - Customization options
 * 4. Stores - Data persistence options
 * 5. Bun - Alternative runtime
 * 6. Guides - Practical guidance
 * 7. Examples - Real-world patterns
 * 8. API Reference - Technical reference
 */
export const navigation: NavSection[] = [
  {
    title: 'Getting Started',
    icon: 'rocket',
    items: [
      { label: 'Introduction', href: '/docs' },
      { label: 'Installation', href: '/docs/installation' },
      { label: 'Quick Start', href: '/docs/quick-start' },
    ],
  },
  {
    title: 'Node.js Adapters',
    icon: 'plug',
    items: [
      { label: 'Express.js', href: '/docs/adapters/express' },
      { label: 'Fastify', href: '/docs/adapters/fastify' },
      { label: 'NestJS', href: '/docs/adapters/nestjs' },
      { label: 'Node.js HTTP', href: '/docs/adapters/node' },
    ],
  },
  {
    title: 'Configuration',
    icon: 'settings',
    items: [
      { label: 'All Options', href: '/docs/configuration/options' },
      { label: 'Time Windows', href: '/docs/configuration/window' },
      { label: 'Tiered Limits', href: '/docs/configuration/tiered' },
      { label: 'Custom Keys', href: '/docs/configuration/custom-key' },
      { label: 'Custom Responses', href: '/docs/configuration/custom-response' },
      { label: 'Headers', href: '/docs/configuration/headers' },
      { label: 'Skip & Whitelist', href: '/docs/configuration/skip' },
    ],
  },
  {
    title: 'Storage Backends',
    icon: 'database',
    items: [
      { label: 'Overview', href: '/docs/stores/overview' },
      { label: 'Memory Store', href: '/docs/stores/memory' },
      { label: 'SQLite Store', href: '/docs/stores/sqlite' },
      { label: 'Redis Store', href: '/docs/stores/redis' },
      { label: 'Custom Stores', href: '/docs/stores/custom' },
    ],
  },
  {
    title: 'Bun Runtime',
    icon: 'zap',
    subsections: [
      {
        title: 'Getting Started',
        items: [
          { label: 'Introduction', href: '/docs/bun' },
          { label: 'Installation', href: '/docs/bun/installation' },
          { label: 'Quick Start', href: '/docs/bun/quick-start' },
        ],
      },
      {
        title: 'Adapters',
        items: [
          { label: 'Bun.serve', href: '/docs/bun/bun-serve' },
          { label: 'Elysia Plugin', href: '/docs/bun/elysia' },
        ],
      },
      {
        title: 'Advanced',
        items: [
          { label: 'Stores', href: '/docs/bun/stores' },
          { label: 'Performance', href: '/docs/bun/performance' },
        ],
      },
    ],
  },
  {
    title: 'Guides',
    icon: 'book',
    items: [
      { label: 'Production Deployment', href: '/docs/guides/production' },
      { label: 'Scaling', href: '/docs/guides/scaling' },
      { label: 'Monitoring', href: '/docs/guides/monitoring' },
      { label: 'Testing', href: '/docs/guides/testing' },
    ],
  },
  {
    title: 'Examples',
    icon: 'layers',
    items: [
      { label: 'Overview', href: '/docs/examples' },
      { label: 'SaaS API', href: '/docs/examples/saas' },
      { label: 'Authentication', href: '/docs/examples/auth' },
      { label: 'E-commerce', href: '/docs/examples/ecommerce' },
      { label: 'Social Platform', href: '/docs/examples/social' },
      { label: 'Gaming Backend', href: '/docs/examples/gaming' },
      { label: 'Cinema Booking', href: '/docs/examples/cinema' },
    ],
  },
  {
    title: 'API Reference',
    icon: 'code',
    items: [
      { label: 'hitlimit()', href: '/docs/api/hitlimit' },
      { label: 'Stores API', href: '/docs/api/stores' },
      { label: 'TypeScript Types', href: '/docs/api/types' },
    ],
  },
  {
    title: 'Benchmarks',
    icon: 'activity',
    items: [
      { label: 'Performance Results', href: '/docs/benchmarks' },
      { label: 'Comparison Overview', href: '/docs/comparison' },
    ],
  },
  {
    title: 'Compare',
    icon: 'layers',
    items: [
      { label: 'All Comparisons', href: '/compare' },
      { label: 'vs express-rate-limit', href: '/compare/express-rate-limit' },
      { label: 'vs rate-limiter-flexible', href: '/compare/rate-limiter-flexible' },
      { label: 'vs @nestjs/throttler', href: '/compare/nestjs-throttler' },
    ],
  },
];

/**
 * Get a flat list of all navigation items in order
 */
export function getFlatNavigation(): NavItem[] {
  const items: NavItem[] = [];

  for (const section of navigation) {
    if (section.items) {
      items.push(...section.items);
    }
    if (section.subsections) {
      for (const sub of section.subsections) {
        items.push(...sub.items);
      }
    }
  }

  return items;
}

/**
 * Navigation result for prev/next links
 */
export interface NavLink {
  label: string;
  href: string;
  section: string;
}

export interface PageNavigation {
  prev: NavLink | null;
  next: NavLink | null;
  current: NavLink | null;
}

/**
 * Get previous and next pages for a given path
 */
export function getPageNavigation(currentPath: string): PageNavigation {
  const flatNav = getFlatNavigation();

  // Normalize path (remove trailing slash)
  const normalizedPath = currentPath.endsWith('/') && currentPath !== '/'
    ? currentPath.slice(0, -1)
    : currentPath;

  // Find current page index
  const currentIndex = flatNav.findIndex(
    item => item.href === normalizedPath || item.href + '/' === currentPath
  );

  if (currentIndex === -1) {
    return { prev: null, next: null, current: null };
  }

  // Find section for each item
  const findSection = (href: string): string => {
    for (const section of navigation) {
      if (section.items?.some(item => item.href === href)) {
        return section.title;
      }
      if (section.subsections) {
        for (const sub of section.subsections) {
          if (sub.items.some(item => item.href === href)) {
            return `${section.title} - ${sub.title}`;
          }
        }
      }
    }
    return '';
  };

  const currentItem = flatNav[currentIndex];
  const prevItem = currentIndex > 0 ? flatNav[currentIndex - 1] : null;
  const nextItem = currentIndex < flatNav.length - 1 ? flatNav[currentIndex + 1] : null;

  return {
    prev: prevItem ? { ...prevItem, section: findSection(prevItem.href) } : null,
    next: nextItem ? { ...nextItem, section: findSection(nextItem.href) } : null,
    current: { ...currentItem, section: findSection(currentItem.href) },
  };
}

/**
 * Find which section contains the active page
 */
export function getActiveSectionIndex(currentPath: string): number {
  const normalizedPath = currentPath.endsWith('/') && currentPath !== '/'
    ? currentPath.slice(0, -1)
    : currentPath;

  return navigation.findIndex(section => {
    if (section.items) {
      return section.items.some(
        item => normalizedPath === item.href || currentPath === item.href + '/'
      );
    }
    if (section.subsections) {
      return section.subsections.some(sub =>
        sub.items.some(
          item => normalizedPath === item.href || currentPath === item.href + '/'
        )
      );
    }
    return false;
  });
}

/**
 * Get total item count for a section
 */
export function getSectionItemCount(section: NavSection): number {
  if (section.items) {
    return section.items.length;
  }
  if (section.subsections) {
    return section.subsections.reduce((acc, sub) => acc + sub.items.length, 0);
  }
  return 0;
}
