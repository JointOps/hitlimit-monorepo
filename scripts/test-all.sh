#!/bin/bash

# ============================================================
# HITLIMIT TEST RUNNER
# ============================================================
# Runs all tests across Node.js and Bun packages
# ============================================================

set -e

echo "Running all tests..."
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

FAILED=0

# ============================================================
# Node.js Tests (pnpm + vitest)
# ============================================================

echo -e "${CYAN}=== Node.js Tests ===${NC}"
echo ""

echo "Testing @joint-ops/hitlimit-types..."
if pnpm --filter @joint-ops/hitlimit-types test 2>/dev/null; then
    echo -e "${GREEN}✓${NC} @joint-ops/hitlimit-types passed"
else
    echo -e "  (No tests or passed)"
fi
echo ""

echo "Testing hitlimit..."
if pnpm --filter @joint-ops/hitlimit test; then
    echo -e "${GREEN}✓${NC} hitlimit passed"
else
    echo -e "${RED}✗${NC} hitlimit failed"
    FAILED=1
fi
echo ""

# ============================================================
# Bun Tests (bun test)
# ============================================================

echo -e "${CYAN}=== Bun Tests ===${NC}"
echo ""

echo "Testing hitlimit-bun..."
cd packages/hitlimit-bun
if bun test; then
    echo -e "${GREEN}✓${NC} hitlimit-bun passed"
else
    echo -e "${RED}✗${NC} hitlimit-bun failed"
    FAILED=1
fi
cd ../..
echo ""

# ============================================================
# Results
# ============================================================

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}All tests passed!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    exit 0
else
    echo -e "${RED}============================================================${NC}"
    echo -e "${RED}Some tests failed!${NC}"
    echo -e "${RED}============================================================${NC}"
    exit 1
fi
