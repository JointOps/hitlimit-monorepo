#!/bin/bash

# ============================================================
# HITLIMIT RELEASE SCRIPT
# ============================================================
# Releases all packages to npm
# ============================================================

set -e

echo "Starting release process..."
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================
# Pre-flight checks
# ============================================================

if [ ! -f "VERSION" ]; then
    echo -e "${RED}VERSION file not found${NC}"
    exit 1
fi

VERSION=$(cat VERSION | tr -d '\n')
echo "Releasing version: $VERSION"
echo ""

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    echo -e "${RED}Must be on main branch (currently on $BRANCH)${NC}"
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Uncommitted changes detected${NC}"
    echo "   Please commit or stash your changes first."
    exit 1
fi

if ! npm whoami &> /dev/null; then
    echo -e "${RED}Not logged in to npm${NC}"
    echo "   Run: npm login"
    exit 1
fi

# ============================================================
# Run verification
# ============================================================

echo -e "${CYAN}Running pre-release verification...${NC}"
echo ""

if ! ./scripts/verify-release.sh; then
    echo -e "${RED}Verification failed. Aborting release.${NC}"
    exit 1
fi

# ============================================================
# Confirm release
# ============================================================

echo ""
echo -e "${YELLOW}About to release:${NC}"
echo "   - @hitlimit/types@$VERSION"
echo "   - hitlimit@$VERSION"
echo "   - hitlimit-bun@$VERSION"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# ============================================================
# Publish packages
# ============================================================

echo ""
echo -e "${CYAN}Publishing packages...${NC}"
echo ""

echo "Publishing @hitlimit/types..."
cd packages/types
npm publish --access public
cd ../..

echo "Publishing hitlimit..."
cd packages/hitlimit
npm publish --access public
cd ../..

echo "Publishing hitlimit-bun..."
# Temporarily update @hitlimit/types dependency to version number for npm
node -e "
const fs = require('fs');
const pkg = require('./packages/hitlimit-bun/package.json');
pkg.dependencies['@hitlimit/types'] = '$VERSION';
fs.writeFileSync('./packages/hitlimit-bun/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
cd packages/hitlimit-bun
npm publish --access public
cd ../..
# Restore file: reference for local development
node -e "
const fs = require('fs');
const pkg = require('./packages/hitlimit-bun/package.json');
pkg.dependencies['@hitlimit/types'] = 'file:../types';
fs.writeFileSync('./packages/hitlimit-bun/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# ============================================================
# Create git tag
# ============================================================

echo ""
echo -e "${CYAN}Creating git tag...${NC}"

git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"

# ============================================================
# Done
# ============================================================

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}Release v$VERSION complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Published:"
echo "  - https://www.npmjs.com/package/@hitlimit/types"
echo "  - https://www.npmjs.com/package/hitlimit"
echo "  - https://www.npmjs.com/package/hitlimit-bun"
echo ""
echo "Next steps:"
echo "  1. Create GitHub release: https://github.com/hitlimit/hitlimit/releases/new?tag=v$VERSION"
echo "  2. Announce on social media"
echo ""
