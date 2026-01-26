#!/bin/bash

# ============================================================
# HITLIMIT MONOREPO SETUP SCRIPT
# ============================================================
# This script sets up the hybrid monorepo correctly:
# - Node.js packages use pnpm
# - Bun packages use bun natively
# ============================================================

set -e

echo "Setting up hitlimit monorepo..."
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================
# STEP 1: Check prerequisites
# ============================================================

echo -e "${CYAN}Step 1: Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "  ${GREEN}✓${NC} Node.js: $NODE_VERSION"

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found. Installing...${NC}"
    npm install -g pnpm
fi
PNPM_VERSION=$(pnpm -v)
echo -e "  ${GREEN}✓${NC} pnpm: $PNPM_VERSION"

if ! command -v bun &> /dev/null; then
    echo -e "${RED}Bun is not installed.${NC}"
    echo -e "   Install with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
BUN_VERSION=$(bun -v)
echo -e "  ${GREEN}✓${NC} Bun: $BUN_VERSION"

if command -v docker &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Docker: $(docker -v | cut -d' ' -f3 | tr -d ',')"
else
    echo -e "  ${YELLOW}!${NC} Docker not found (optional, needed for Redis tests)"
fi

echo ""

# ============================================================
# STEP 2: Install Node.js dependencies (pnpm)
# ============================================================

echo -e "${CYAN}Step 2: Installing Node.js dependencies (pnpm)...${NC}"

pnpm install

echo -e "  ${GREEN}✓${NC} Node.js dependencies installed"
echo ""

# ============================================================
# STEP 3: Install Bun dependencies (bun)
# ============================================================

echo -e "${CYAN}Step 3: Installing Bun dependencies (bun)...${NC}"

echo "  Installing packages/hitlimit-bun..."
cd packages/hitlimit-bun
bun install
cd ../..

echo -e "  ${GREEN}✓${NC} Bun dependencies installed"
echo ""

# ============================================================
# STEP 4: Build packages
# ============================================================

echo -e "${CYAN}Step 4: Building packages...${NC}"

echo "  Building @joint-ops/hitlimit-types..."
pnpm --filter @joint-ops/hitlimit-types build

echo "  Building hitlimit..."
pnpm --filter @joint-ops/hitlimit build

echo "  Building hitlimit-bun..."
cd packages/hitlimit-bun
bun run build
cd ../..

echo -e "  ${GREEN}✓${NC} All packages built"
echo ""

# ============================================================
# STEP 5: Verify setup
# ============================================================

echo -e "${CYAN}Step 5: Verifying setup...${NC}"

if [ -f "packages/hitlimit/dist/index.js" ]; then
    echo -e "  ${GREEN}✓${NC} hitlimit/dist/index.js exists"
else
    echo -e "  ${RED}✗${NC} hitlimit/dist/index.js missing"
    exit 1
fi

if [ -f "packages/hitlimit-bun/dist/index.js" ]; then
    echo -e "  ${GREEN}✓${NC} hitlimit-bun/dist/index.js exists"
else
    echo -e "  ${RED}✗${NC} hitlimit-bun/dist/index.js missing"
    exit 1
fi

echo ""

# ============================================================
# DONE
# ============================================================

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}Setup complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Next steps:"
echo "  Run tests:       pnpm test"
echo "  Run benchmarks:  pnpm benchmark"
echo "  Start docs:      pnpm docs:dev"
echo "  Start Redis:     pnpm docker:up"
echo ""
