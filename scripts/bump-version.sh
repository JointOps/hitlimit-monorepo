#!/bin/bash

# ============================================================
# HITLIMIT VERSION BUMP SCRIPT
# ============================================================
# Updates version in all package.json files
# ============================================================

set -e

if [ ! -f "VERSION" ]; then
    echo "VERSION file not found"
    exit 1
fi

VERSION=$(cat VERSION | tr -d '\n')
echo "Bumping all packages to version: $VERSION"

node -e "
const fs = require('fs');
const pkg = require('./packages/types/package.json');
pkg.version = '$VERSION';
fs.writeFileSync('./packages/types/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  @hitlimit/types"

node -e "
const fs = require('fs');
const pkg = require('./packages/hitlimit/package.json');
pkg.version = '$VERSION';
if (pkg.dependencies && pkg.dependencies['@hitlimit/types']) {
  pkg.dependencies['@hitlimit/types'] = 'workspace:*';
}
fs.writeFileSync('./packages/hitlimit/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  hitlimit"

node -e "
const fs = require('fs');
const pkg = require('./packages/hitlimit-bun/package.json');
pkg.version = '$VERSION';
// Keep file:../types for local development
// The release script will update this before publishing
fs.writeFileSync('./packages/hitlimit-bun/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  hitlimit-bun"

echo ""
echo "All packages updated to version $VERSION"
echo ""
echo "Next steps:"
echo "  1. git add ."
echo "  2. git commit -m 'chore: bump version to $VERSION'"
echo "  3. ./scripts/release.sh"
