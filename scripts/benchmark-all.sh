#!/bin/bash
set -e

# Check Redis (port 6379) and Postgres (port 5433) are reachable
REDIS_OK=false
POSTGRES_OK=false

if nc -z localhost 6379 2>/dev/null; then
  REDIS_OK=true
  echo "Redis: available on port 6379"
else
  echo "Redis: not found on port 6379"
fi

if nc -z localhost 5433 2>/dev/null; then
  POSTGRES_OK=true
  echo "Postgres: available on port 5433"
else
  echo "Postgres: not found on port 5433"
fi

if [ "$REDIS_OK" = false ] || [ "$POSTGRES_OK" = false ]; then
  echo ""
  echo "ERROR: Redis and Postgres are required for bench:all"
  echo ""
  echo "Start them with Docker:"
  echo "  docker run -d --name bench-redis -p 6379:6379 redis:7-alpine"
  echo "  docker run -d --name bench-postgres -p 5433:5432 \\"
  echo "    -e POSTGRES_USER=hitlimit \\"
  echo "    -e POSTGRES_PASSWORD=hitlimit \\"
  echo "    -e POSTGRES_DB=hitlimit_test \\"
  echo "    postgres:16-alpine"
  echo ""
  echo "Or run only memory/sqlite benchmarks:"
  echo "  cd benchmarks && pnpm bench:node:store:memory"
  exit 1
fi

echo ""
pnpm build
cd benchmarks
pnpm bench:all

# Final cleanup — flush Redis and drop Postgres benchmark tables
echo ""
echo "Cleaning up benchmark data..."
docker exec bench-redis redis-cli FLUSHDB 2>/dev/null || true
docker exec bench-postgres psql -U hitlimit -d hitlimit_test -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' 2>/dev/null || true
echo "Cleanup complete."
