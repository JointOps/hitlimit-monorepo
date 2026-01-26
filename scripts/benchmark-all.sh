#!/bin/bash

# ============================================================
# HITLIMIT BENCHMARK RUNNER
# ============================================================
# Runs all benchmarks across Node.js and Bun
# ============================================================

set -e

echo "Running all benchmarks..."
echo ""

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

mkdir -p benchmarks/results

# ============================================================
# Node.js Benchmarks
# ============================================================

echo -e "${CYAN}=== Node.js Benchmarks ===${NC}"
echo ""

pnpm benchmark

echo ""

# ============================================================
# Bun Benchmarks
# ============================================================

echo -e "${CYAN}=== Bun Benchmarks ===${NC}"
echo ""

cd benchmarks/bun
if [ -f "index.ts" ]; then
    bun run index.ts
else
    echo "No Bun benchmarks found"
fi
cd ../..

echo ""
echo -e "${GREEN}Benchmarks complete!${NC}"
echo "   Results saved to: benchmarks/results/"
echo ""
