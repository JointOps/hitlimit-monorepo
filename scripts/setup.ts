#!/usr/bin/env npx tsx
/**
 * hitlimit Development Setup Script
 *
 * Run this after cloning the repo to set up your development environment.
 *
 * Usage:
 *   npx tsx scripts/setup.ts
 *   # or
 *   bun scripts/setup.ts
 */

import { execSync, spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

// ============================================================
// Colors & Formatting
// ============================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
}

const c = colors

const log = {
  info: (msg: string) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`),
  success: (msg: string) => console.log(`${c.green}✓${c.reset} ${msg}`),
  warn: (msg: string) => console.log(`${c.yellow}⚠${c.reset} ${msg}`),
  error: (msg: string) => console.log(`${c.red}✗${c.reset} ${msg}`),
  step: (msg: string) => console.log(`\n${c.bold}${c.blue}▶${c.reset} ${c.bold}${msg}${c.reset}`),
  dim: (msg: string) => console.log(`  ${c.dim}${msg}${c.reset}`),
}

// ============================================================
// ASCII Banner
// ============================================================

function printBanner() {
  console.log(`
${c.cyan}${c.bold}
  ╦ ╦╦╔╦╗╦  ╦╔╦╗╦╔╦╗
  ╠═╣║ ║ ║  ║║║║║ ║
  ╩ ╩╩ ╩ ╩═╝╩╩ ╩╩ ╩
${c.reset}
  ${c.dim}The fastest way to say no${c.reset}
  ${c.dim}Development Environment Setup${c.reset}
`)
}

// ============================================================
// Requirement Checking
// ============================================================

interface Requirement {
  name: string
  command: string
  versionFlag: string
  minVersion?: string
  installUrl: string
  installInstructions: string[]
  optional?: boolean
}

const requirements: Requirement[] = [
  {
    name: 'Node.js',
    command: 'node',
    versionFlag: '--version',
    minVersion: '18.0.0',
    installUrl: 'https://nodejs.org',
    installInstructions: [
      'Download from https://nodejs.org (LTS recommended)',
      'Or use a version manager like nvm:',
      '  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash',
      '  nvm install 20',
    ],
  },
  {
    name: 'pnpm',
    command: 'pnpm',
    versionFlag: '--version',
    minVersion: '8.0.0',
    installUrl: 'https://pnpm.io/installation',
    installInstructions: [
      'Install via npm:',
      '  npm install -g pnpm',
      '',
      'Or via corepack (recommended):',
      '  corepack enable',
      '  corepack prepare pnpm@latest --activate',
      '',
      'Or via standalone script:',
      '  curl -fsSL https://get.pnpm.io/install.sh | sh -',
    ],
  },
  {
    name: 'Bun',
    command: 'bun',
    versionFlag: '--version',
    minVersion: '1.0.0',
    installUrl: 'https://bun.sh',
    installInstructions: [
      'Install via curl (macOS/Linux):',
      '  curl -fsSL https://bun.sh/install | bash',
      '',
      'Install via npm:',
      '  npm install -g bun',
      '',
      'Install via Homebrew (macOS):',
      '  brew install oven-sh/bun/bun',
    ],
  },
]

function checkCommand(command: string, versionFlag: string): { installed: boolean; version?: string } {
  try {
    const result = spawnSync(command, [versionFlag], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    })

    if (result.status === 0) {
      const version = (result.stdout || result.stderr).trim().replace(/^v/, '')
      return { installed: true, version }
    }
    return { installed: false }
  } catch {
    return { installed: false }
  }
}

function compareVersions(current: string, minimum: string): boolean {
  const currentParts = current.split('.').map(Number)
  const minimumParts = minimum.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    const curr = currentParts[i] || 0
    const min = minimumParts[i] || 0
    if (curr > min) return true
    if (curr < min) return false
  }
  return true
}

function checkRequirements(): { allMet: boolean; missing: Requirement[] } {
  log.step('Checking requirements')
  console.log()

  const missing: Requirement[] = []

  for (const req of requirements) {
    const check = checkCommand(req.command, req.versionFlag)

    if (!check.installed) {
      console.log(`  ${c.red}✗${c.reset} ${req.name} ${c.dim}(not installed)${c.reset}`)
      missing.push(req)
    } else if (req.minVersion && !compareVersions(check.version!, req.minVersion)) {
      console.log(`  ${c.yellow}⚠${c.reset} ${req.name} ${c.dim}v${check.version} (need >= ${req.minVersion})${c.reset}`)
      missing.push(req)
    } else {
      console.log(`  ${c.green}✓${c.reset} ${req.name} ${c.dim}v${check.version}${c.reset}`)
    }
  }

  return { allMet: missing.length === 0, missing }
}

function printMissingRequirements(missing: Requirement[]) {
  console.log(`
${c.bgRed}${c.white}${c.bold} MISSING REQUIREMENTS ${c.reset}

${c.yellow}The following tools need to be installed before you can contribute:${c.reset}
`)

  for (const req of missing) {
    console.log(`${c.bold}${c.red}${req.name}${c.reset}`)
    console.log(`${c.dim}${req.installUrl}${c.reset}`)
    console.log()
    for (const instruction of req.installInstructions) {
      if (instruction.startsWith('  ')) {
        console.log(`  ${c.cyan}${instruction.trim()}${c.reset}`)
      } else {
        console.log(`  ${instruction}`)
      }
    }
    console.log()
  }

  console.log(`${c.yellow}After installing, run this setup script again:${c.reset}`)
  console.log(`  ${c.cyan}npx tsx scripts/setup.ts${c.reset}`)
  console.log()
}

// ============================================================
// Setup Steps
// ============================================================

function runCommand(command: string, description: string): boolean {
  log.dim(command)
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
    return true
  } catch (error) {
    log.error(`Failed: ${description}`)
    return false
  }
}

function setupNodePackages(): boolean {
  log.step('Installing Node.js dependencies (pnpm)')
  return runCommand('pnpm install', 'pnpm install')
}

function setupBunPackage(): boolean {
  log.step('Installing Bun dependencies (hitlimit-bun)')
  const bunDir = join(process.cwd(), 'packages', 'hitlimit-bun')

  if (!existsSync(bunDir)) {
    log.error('packages/hitlimit-bun directory not found')
    return false
  }

  return runCommand('cd packages/hitlimit-bun && bun install', 'bun install')
}

function buildPackages(): boolean {
  log.step('Building packages')

  // Build Node.js packages first
  log.info('Building @joint-ops/hitlimit-types and @joint-ops/hitlimit...')
  if (!runCommand('pnpm turbo run build --filter=@joint-ops/hitlimit-types --filter=@joint-ops/hitlimit', 'build Node.js packages')) {
    return false
  }

  // Build Bun package
  log.info('Building hitlimit-bun...')
  if (!runCommand('cd packages/hitlimit-bun && bun run build', 'build hitlimit-bun')) {
    return false
  }

  return true
}

function runTests(): boolean {
  log.step('Running tests to verify setup')

  // Run Node.js tests
  log.info('Testing hitlimit...')
  if (!runCommand('pnpm turbo run test --filter=hitlimit', 'Node.js tests')) {
    return false
  }

  // Run Bun tests
  log.info('Testing hitlimit-bun...')
  if (!runCommand('cd packages/hitlimit-bun && bun test', 'Bun tests')) {
    return false
  }

  return true
}

// ============================================================
// Main
// ============================================================

async function main() {
  printBanner()

  // Check if we're in the right directory
  if (!existsSync('package.json') || !existsSync('packages')) {
    console.log(`${c.red}${c.bold}Error:${c.reset} This script must be run from the hitlimit monorepo root.`)
    console.log()
    console.log(`${c.dim}Expected to find package.json and packages/ directory.${c.reset}`)
    console.log(`${c.dim}Current directory: ${process.cwd()}${c.reset}`)
    process.exit(1)
  }

  // Check requirements
  const { allMet, missing } = checkRequirements()

  if (!allMet) {
    printMissingRequirements(missing)
    process.exit(1)
  }

  console.log()
  log.success('All requirements met!')

  // Run setup steps
  const steps = [
    { fn: setupNodePackages, name: 'Node.js dependencies' },
    { fn: setupBunPackage, name: 'Bun dependencies' },
    { fn: buildPackages, name: 'Build packages' },
  ]

  for (const step of steps) {
    if (!step.fn()) {
      console.log()
      log.error(`Setup failed at: ${step.name}`)
      console.log()
      console.log(`${c.yellow}If you need help, please open an issue:${c.reset}`)
      console.log(`  ${c.cyan}https://github.com/JointOps/hitlimit-monorepo/issues${c.reset}`)
      process.exit(1)
    }
  }

  // Ask if user wants to run tests
  console.log()
  log.info('Running tests to verify everything works...')

  if (!runTests()) {
    console.log()
    log.warn('Some tests failed, but setup is complete.')
    log.dim('This might be due to missing Redis. Tests will pass in CI.')
  }

  // Success!
  console.log(`
${c.bgGreen}${c.white}${c.bold} SETUP COMPLETE ${c.reset}

${c.green}${c.bold}You're all set to contribute to hitlimit!${c.reset}

${c.bold}Quick Commands:${c.reset}

  ${c.cyan}pnpm test${c.reset}              Run all tests
  ${c.cyan}pnpm build${c.reset}             Build all packages
  ${c.cyan}pnpm benchmark${c.reset}         Run benchmarks
  ${c.cyan}pnpm docs:dev${c.reset}          Start docs dev server

${c.bold}Package-Specific:${c.reset}

  ${c.cyan}pnpm test:node${c.reset}         Test Node.js packages only
  ${c.cyan}pnpm test:bun${c.reset}          Test Bun package only
  ${c.cyan}pnpm build:node${c.reset}        Build Node.js packages only
  ${c.cyan}pnpm build:bun${c.reset}         Build Bun package only

${c.bold}Monorepo Structure:${c.reset}

  ${c.dim}packages/types${c.reset}       Shared TypeScript types
  ${c.dim}packages/hitlimit${c.reset}    Node.js rate limiter (Express, NestJS)
  ${c.dim}packages/hitlimit-bun${c.reset} Bun rate limiter (Bun.serve, Elysia)
  ${c.dim}docs/${c.reset}                Documentation site (Astro)
  ${c.dim}benchmarks/${c.reset}          Performance benchmarks

${c.bold}Documentation:${c.reset} ${c.cyan}https://hitlimit.jointops.dev${c.reset}

${c.dim}Happy coding! ${c.reset}
`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
