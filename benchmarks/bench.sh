#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

# ── Colors (check stderr since menus display there) ─────────────────────────
if [[ -t 2 ]]; then
  BOLD='\033[1m' DIM='\033[2m' GREEN='\033[32m'
  YELLOW='\033[33m' RED='\033[31m' CYAN='\033[36m' RESET='\033[0m'
else
  BOLD='' DIM='' GREEN='' YELLOW='' RED='' CYAN='' RESET=''
fi

# All display goes to stderr so $() capture doesn't eat it
log()  { printf "${BOLD}${CYAN}==> %s${RESET}\n" "$*" >&2; }
ok()   { printf "${GREEN}    %s${RESET}\n" "$*" >&2; }
warn() { printf "${YELLOW}    %s${RESET}\n" "$*" >&2; }
err()  { printf "${RED}ERROR: %s${RESET}\n" "$*" >&2; }
dim()  { printf "${DIM}    %s${RESET}\n" "$*" >&2; }

# ── Store lookups (bash 3.2 compatible) ──────────────────────────────────────

store_container() {
  case "$1" in
    redis)     echo "hitlimit-redis" ;;
    postgres)  echo "hitlimit-postgres" ;;
    valkey)    echo "hitlimit-valkey" ;;
    dragonfly) echo "hitlimit-dragonfly" ;;
    *)         echo "" ;;
  esac
}

store_port() {
  case "$1" in
    redis)     echo "6379" ;;
    postgres)  echo "5433" ;;
    valkey)    echo "6381" ;;
    dragonfly) echo "6382" ;;
    *)         echo "" ;;
  esac
}

store_profile() {
  case "$1" in
    valkey)    echo "valkey" ;;
    dragonfly) echo "dragonfly" ;;
    *)         echo "" ;;
  esac
}

store_service() {
  case "$1" in
    redis)     echo "redis" ;;
    postgres)  echo "postgres" ;;
    valkey)    echo "valkey" ;;
    dragonfly) echo "dragonfly" ;;
    *)         echo "" ;;
  esac
}

needs_docker() {
  [[ "$1" != "memory" && "$1" != "sqlite" ]]
}

container_running() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${1}$"
}

# ── Docker management ────────────────────────────────────────────────────────

ensure_service() {
  local store="$1"
  needs_docker "$store" || return 0

  local cname
  cname=$(store_container "$store")
  local port
  port=$(store_port "$store")

  # If already running, clean it first so we start fresh
  if container_running "$cname"; then
    dim "$cname already running, cleaning..."
    clean_store "$store"
    ok "$cname cleaned and ready"
    return 0
  fi

  log "Starting $cname..."
  local profile
  profile=$(store_profile "$store")
  local service
  service=$(store_service "$store")

  if [[ -n "$profile" ]]; then
    docker compose -f "$COMPOSE_FILE" --profile "$profile" up -d "$service" 2>/dev/null
  else
    docker compose -f "$COMPOSE_FILE" up -d "$service" 2>/dev/null
  fi

  dim "Waiting for $cname..."
  local attempts=0
  while [[ $attempts -lt 30 ]]; do
    if nc -z localhost "$port" 2>/dev/null; then
      if [[ "$store" == "postgres" ]]; then
        if docker exec "$cname" pg_isready -U hitlimit -d hitlimit_test &>/dev/null; then
          ok "$cname is ready"
          return 0
        fi
      else
        ok "$cname is ready"
        return 0
      fi
    fi
    sleep 1
    attempts=$((attempts + 1))
  done

  err "$cname failed to start after 30s"
  return 1
}

clean_store() {
  local store="$1"
  case "$store" in
    redis)     docker exec hitlimit-redis redis-cli FLUSHDB 2>/dev/null || true ;;
    postgres)  docker exec hitlimit-postgres psql -U hitlimit -d hitlimit_test \
                 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' 2>/dev/null || true ;;
    valkey)    docker exec hitlimit-valkey valkey-cli FLUSHDB 2>/dev/null || true ;;
    dragonfly) docker exec hitlimit-dragonfly redis-cli FLUSHDB 2>/dev/null || true ;;
  esac
}

# ── Benchmark execution ─────────────────────────────────────────────────────

run_bench() {
  local runtime="$1" file="$2"
  local full_path="$SCRIPT_DIR/$file"

  if [[ ! -f "$full_path" ]]; then
    dim "skip: $file (not found)"
    return 0
  fi

  printf "\n" >&2
  dim "Running: $file"
  if [[ "$runtime" == "node" ]]; then
    NODE_OPTIONS='--expose-gc' npx tsx "$full_path"
  else
    bun "$full_path"
  fi
}

find_competitors() {
  local runtime="$1" framework="$2" store="$3"
  local base_dir="$SCRIPT_DIR/$runtime/$framework"
  local result=""

  if [[ -d "$base_dir" ]]; then
    for lib_dir in "$base_dir"/*/; do
      local lib_name
      lib_name="$(basename "$lib_dir")"
      [[ "$lib_name" == "hitlimit" ]] && continue
      if [[ -f "$lib_dir/$store.ts" ]]; then
        if [[ -n "$result" ]]; then
          result="$result $lib_name"
        else
          result="$lib_name"
        fi
      fi
    done
  fi

  echo "$result"
}

# ── Menu helper ──────────────────────────────────────────────────────────────
# All display goes to stderr. Only the selected value goes to stdout.
# Reads input from /dev/tty so it works inside $() capture.

pick_one() {
  local prompt="$1"
  shift
  local options=("$@")
  local count=${#options[@]}

  printf "${BOLD}${CYAN}==> %s${RESET}\n" "$prompt" >&2
  local i=1
  for opt in "${options[@]}"; do
    printf "  ${BOLD}%d)${RESET} %s\n" "$i" "$opt" >&2
    i=$((i + 1))
  done
  printf "\n" >&2

  while true; do
    printf "> " >&2
    read -r choice </dev/tty
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= count )); then
      echo "${options[$((choice - 1))]}"
      return 0
    fi
    printf "${YELLOW}    Invalid choice. Enter 1-%d${RESET}\n" "$count" >&2
  done
}

# ── Usage ────────────────────────────────────────────────────────────────────

usage() {
  cat <<'EOF'
Interactive benchmark runner for hitlimit.

Usage:
  ./bench.sh                    Interactive mode (menus)
  ./bench.sh [options]          Non-interactive mode

Options:
  --store <name>        Store: memory, sqlite, redis, postgres, valkey, dragonfly
  --runtime <name>      Runtime: node, bun
  --framework <name>    Framework: store, express, fastify, hono, nestjs,
                                   bun-serve, elysia
  --no-competitors      Skip competitor library benchmarks
  --help                Show this help

Examples:
  ./bench.sh                                        # Interactive menus
  ./bench.sh --store redis --runtime node --framework fastify
  ./bench.sh --store memory --runtime bun --framework hono --no-competitors
EOF
  exit 0
}

# ── Validation helpers ───────────────────────────────────────────────────────

valid_store() {
  case "$1" in
    memory|sqlite|redis|postgres|valkey|dragonfly) return 0 ;;
    *) return 1 ;;
  esac
}

valid_node_framework() {
  case "$1" in
    store|express|fastify|hono|nestjs) return 0 ;;
    *) return 1 ;;
  esac
}

valid_bun_framework() {
  case "$1" in
    store|bun-serve|elysia|hono) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Main ─────────────────────────────────────────────────────────────────────

OPT_STORE=""
OPT_RUNTIME=""
OPT_FRAMEWORK=""
OPT_NO_COMPETITORS=false
INTERACTIVE=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --store)          OPT_STORE="$2"; INTERACTIVE=false; shift 2 ;;
    --runtime)        OPT_RUNTIME="$2"; INTERACTIVE=false; shift 2 ;;
    --framework)      OPT_FRAMEWORK="$2"; INTERACTIVE=false; shift 2 ;;
    --no-competitors) OPT_NO_COMPETITORS=true; shift ;;
    --help|-h)        usage ;;
    *) err "Unknown option: $1"; usage ;;
  esac
done

printf "\n" >&2
printf "${BOLD}  hitlimit benchmark runner${RESET}\n" >&2
printf "\n" >&2

# ── Interactive mode ─────────────────────────────────────────────────────────

if $INTERACTIVE; then
  # 1. Pick runtime
  RUNTIME=$(pick_one "Select runtime:" node bun)
  printf "\n" >&2

  # 2. Pick framework
  if [[ "$RUNTIME" == "node" ]]; then
    FRAMEWORK=$(pick_one "Select framework:" store express fastify hono nestjs)
  else
    FRAMEWORK=$(pick_one "Select framework:" store bun-serve elysia hono)
  fi
  printf "\n" >&2

  # 3. Pick store — only show stores that have a benchmark file
  available_stores=()
  for s in memory sqlite redis postgres valkey dragonfly; do
    if [[ -f "$SCRIPT_DIR/$RUNTIME/$FRAMEWORK/hitlimit/$s.ts" ]]; then
      available_stores+=("$s")
    fi
  done

  if [[ ${#available_stores[@]} -eq 0 ]]; then
    err "No benchmarks found for $RUNTIME / $FRAMEWORK"
    exit 1
  fi

  STORE=$(pick_one "Select store:" "${available_stores[@]}")
  printf "\n" >&2

  # 4. Docker — auto start + clean, no questions asked
  if needs_docker "$STORE"; then
    ensure_service "$STORE"
    printf "\n" >&2
  fi

  # 5. Competitors — auto-detect, ask once
  COMPETITORS=$(find_competitors "$RUNTIME" "$FRAMEWORK" "$STORE")
  INCLUDE_COMPETITORS=false
  if [[ -n "$COMPETITORS" ]]; then
    printf "${BOLD}${CYAN}==> Include competitors? (%s) [Y/n]${RESET} " "$COMPETITORS" >&2
    read -r answer </dev/tty
    answer="${answer:-y}"
    if [[ "$answer" =~ ^[Yy] ]]; then
      INCLUDE_COMPETITORS=true
    fi
    printf "\n" >&2
  fi

  # 6. Run
  log "Running: $RUNTIME / $FRAMEWORK / $STORE"

  run_bench "$RUNTIME" "$RUNTIME/$FRAMEWORK/hitlimit/$STORE.ts"

  if $INCLUDE_COMPETITORS; then
    for comp in $COMPETITORS; do
      dim "Cleaning store between runs..."
      clean_store "$STORE"
      run_bench "$RUNTIME" "$RUNTIME/$FRAMEWORK/$comp/$STORE.ts"
    done
  fi

  # 7. Cleanup
  if needs_docker "$STORE"; then
    printf "\n" >&2
    dim "Cleaning $STORE data..."
    clean_store "$STORE"
    ok "Store cleaned"
  fi

# ── Non-interactive mode ─────────────────────────────────────────────────────

else
  if [[ -z "$OPT_STORE" || -z "$OPT_RUNTIME" || -z "$OPT_FRAMEWORK" ]]; then
    err "Non-interactive mode requires --store, --runtime, and --framework"
    exit 1
  fi

  STORE="$OPT_STORE"
  RUNTIME="$OPT_RUNTIME"
  FRAMEWORK="$OPT_FRAMEWORK"

  # Validate
  if ! valid_store "$STORE"; then
    err "Invalid store: $STORE (expected: memory, sqlite, redis, postgres, valkey, dragonfly)"; exit 1
  fi
  if [[ "$RUNTIME" != "node" && "$RUNTIME" != "bun" ]]; then
    err "Invalid runtime: $RUNTIME (expected: node, bun)"; exit 1
  fi
  if [[ "$RUNTIME" == "node" ]]; then
    if ! valid_node_framework "$FRAMEWORK"; then
      err "Invalid node framework: $FRAMEWORK (expected: store, express, fastify, hono, nestjs)"; exit 1
    fi
  else
    if ! valid_bun_framework "$FRAMEWORK"; then
      err "Invalid bun framework: $FRAMEWORK (expected: store, bun-serve, elysia, hono)"; exit 1
    fi
  fi

  # Docker — auto start + clean
  if needs_docker "$STORE"; then
    ensure_service "$STORE"
    printf "\n" >&2
  fi

  # Run
  log "Running: $RUNTIME / $FRAMEWORK / $STORE"

  run_bench "$RUNTIME" "$RUNTIME/$FRAMEWORK/hitlimit/$STORE.ts"

  if ! $OPT_NO_COMPETITORS; then
    COMPETITORS=$(find_competitors "$RUNTIME" "$FRAMEWORK" "$STORE")
    for comp in $COMPETITORS; do
      dim "Cleaning store between runs..."
      clean_store "$STORE"
      run_bench "$RUNTIME" "$RUNTIME/$FRAMEWORK/$comp/$STORE.ts"
    done
  fi

  # Cleanup
  if needs_docker "$STORE"; then
    printf "\n" >&2
    dim "Cleaning $STORE data..."
    clean_store "$STORE"
    ok "Store cleaned"
  fi
fi

printf "\n" >&2
log "Done!"
