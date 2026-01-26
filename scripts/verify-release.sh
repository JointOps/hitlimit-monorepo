#!/bin/bash

# ============================================================
# HITLIMIT PRE-RELEASE VERIFICATION
# ============================================================
# This script MUST pass before any release
# ============================================================

set -e

echo "Verifying release readiness..."
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ERRORS=0

# ============================================================
# STEP 1: Check VERSION file
# ============================================================

echo -e "${CYAN}Step 1: Checking VERSION file...${NC}"

if [ ! -f "VERSION" ]; then
    echo -e "${RED}VERSION file not found${NC}"
    ERRORS=$((ERRORS + 1))
else
    VERSION=$(cat VERSION | tr -d '\n')
    echo -e "  ${GREEN}✓${NC} Version: $VERSION"

    if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "${RED}Invalid version format (must be X.Y.Z)${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi
echo ""

# ============================================================
# STEP 2: Check package.json versions match
# ============================================================

echo -e "${CYAN}Step 2: Checking package versions...${NC}"

TYPES_VERSION=$(node -p "require('./packages/types/package.json').version")
HITLIMIT_VERSION=$(node -p "require('./packages/hitlimit/package.json').version")
HITLIMIT_BUN_VERSION=$(node -p "require('./packages/hitlimit-bun/package.json').version")

echo "  @hitlimit/types:  $TYPES_VERSION"
echo "  hitlimit:         $HITLIMIT_VERSION"
echo "  hitlimit-bun:     $HITLIMIT_BUN_VERSION"

if [ "$VERSION" != "$TYPES_VERSION" ] || [ "$VERSION" != "$HITLIMIT_VERSION" ] || [ "$VERSION" != "$HITLIMIT_BUN_VERSION" ]; then
    echo -e "${YELLOW}Package versions don't match VERSION file${NC}"
    echo "  Run: ./scripts/bump-version.sh"
else
    echo -e "  ${GREEN}✓${NC} All versions match"
fi
echo ""

# ============================================================
# STEP 3: Build all packages
# ============================================================

echo -e "${CYAN}Step 3: Building packages...${NC}"

pnpm --filter @hitlimit/types build
pnpm --filter hitlimit build
cd packages/hitlimit-bun && bun run build && cd ../..

echo -e "  ${GREEN}✓${NC} Build successful"
echo ""

# ============================================================
# STEP 4: Run all tests
# ============================================================

echo -e "${CYAN}Step 4: Running tests...${NC}"

if ! ./scripts/test-all.sh; then
    echo -e "${RED}Tests failed${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "  ${GREEN}✓${NC} All tests passed"
fi
echo ""

# ============================================================
# STEP 5: Check bundle sizes
# ============================================================

echo -e "${CYAN}Step 5: Checking bundle sizes...${NC}"

if [ -f "packages/hitlimit/dist/index.js" ]; then
    HITLIMIT_SIZE=$(wc -c < packages/hitlimit/dist/index.js)
    echo "  hitlimit:     $(($HITLIMIT_SIZE / 1024))KB"
fi

if [ -f "packages/hitlimit-bun/dist/index.js" ]; then
    HITLIMIT_BUN_SIZE=$(wc -c < packages/hitlimit-bun/dist/index.js)
    echo "  hitlimit-bun: $(($HITLIMIT_BUN_SIZE / 1024))KB"
fi

echo -e "  ${GREEN}✓${NC} Bundle sizes checked"
echo ""

# ============================================================
# Results
# ============================================================

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}Release verification passed!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo "Ready to release version $VERSION"
    echo ""
    echo "Next steps:"
    echo "  1. Review CHANGELOG.md"
    echo "  2. Run: ./scripts/release.sh"
    exit 0
else
    echo -e "${RED}============================================================${NC}"
    echo -e "${RED}Release verification FAILED ($ERRORS errors)${NC}"
    echo -e "${RED}============================================================${NC}"
    echo ""
    echo "Fix the errors above before releasing."
    exit 1
fi
