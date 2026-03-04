#!/bin/bash
set -eo pipefail

# ============================================================
#  HITLIMIT BENCHMARK SUITE
# ============================================================

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $REPO_ROOT/docker-compose.yml"
BENCH_DIR="$REPO_ROOT/benchmarks"
RESULTS_DIR="$BENCH_DIR/results"
VERSION=$(cat "$REPO_ROOT/VERSION" 2>/dev/null || echo "dev")
VERSION_DIR="$RESULTS_DIR/v$VERSION"

# ── Colors ──────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD='\033[1m' DIM='\033[2m'
  RED='\033[31m' GREEN='\033[32m' YELLOW='\033[33m'
  CYAN='\033[36m' NC='\033[0m'
else
  BOLD='' DIM='' RED='' GREEN='' YELLOW='' CYAN='' NC=''
fi

# ── Helpers ─────────────────────────────────────────────────
banner()  { printf "\n${BOLD}${CYAN}  %s${NC}\n\n" "$*"; }
header()  { printf "${BOLD}${CYAN}==> %s${NC}\n" "$*"; }
ok()      { printf "${GREEN}  ✓ %s${NC}\n" "$*"; }
warn()    { printf "${YELLOW}  ! %s${NC}\n" "$*"; }
err()     { printf "${RED}  ✗ %s${NC}\n" "$*"; }
dim()     { printf "${DIM}    %s${NC}\n" "$*"; }
divider() { printf "${DIM}%s${NC}\n" "────────────────────────────────────────────────────────────"; }

ALL_STORES="memory sqlite redis postgres valkey dragonfly mongodb mysql"
DOCKER_STORES="redis postgres valkey dragonfly mongodb mysql"
NODE_FRAMEWORKS="store express fastify hono nestjs"
BUN_FRAMEWORKS="store bun-serve elysia hono"

# ── Menu ────────────────────────────────────────────────────
pick_one() {
  local prompt="$1"; shift
  local options=("$@")
  local count=${#options[@]}

  printf "\n${BOLD}${CYAN}  %s${NC}\n" "$prompt"
  local i=1
  for opt in "${options[@]}"; do
    printf "    ${BOLD}%d)${NC} %s\n" "$i" "$opt"
    i=$((i + 1))
  done
  printf "\n"

  while true; do
    printf "  ${BOLD}>${NC} "
    read -r choice </dev/tty
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= count )); then
      PICK_RESULT="${options[$((choice - 1))]}"
      return 0
    fi
    printf "${YELLOW}    Enter 1-%d${NC}\n" "$count"
  done
}

pick_multi() {
  local prompt="$1"; shift
  local options=("$@")
  local count=${#options[@]}

  printf "\n${BOLD}${CYAN}  %s${NC}\n" "$prompt"
  local i=1
  for opt in "${options[@]}"; do
    printf "    ${BOLD}%d)${NC} %s\n" "$i" "$opt"
    i=$((i + 1))
  done
  printf "    ${DIM}Comma-separated (e.g. 1,3,5) or 'all'${NC}\n\n"

  while true; do
    printf "  ${BOLD}>${NC} "
    read -r input </dev/tty
    if [[ "$input" == "all" ]]; then
      PICK_RESULTS=("${options[@]}")
      return 0
    fi
    PICK_RESULTS=()
    local valid=true
    IFS=',' read -ra nums <<< "$input"
    for n in "${nums[@]}"; do
      n=$(echo "$n" | tr -d ' ')
      if [[ "$n" =~ ^[0-9]+$ ]] && (( n >= 1 && n <= count )); then
        PICK_RESULTS+=("${options[$((n - 1))]}")
      else
        valid=false; break
      fi
    done
    if $valid && [[ ${#PICK_RESULTS[@]} -gt 0 ]]; then
      return 0
    fi
    printf "${YELLOW}    Enter numbers 1-%d separated by commas, or 'all'${NC}\n" "$count"
  done
}

confirm() {
  printf "${BOLD}  %s [Y/n]${NC} " "$1"
  read -r answer </dev/tty
  answer="${answer:-y}"
  [[ "$answer" =~ ^[Yy] ]]
}

# ── Docker ──────────────────────────────────────────────────
needs_docker() {
  [[ "$1" != "memory" && "$1" != "sqlite" ]]
}

start_store() {
  local store="$1"
  needs_docker "$store" || return 0

  local timeout=60
  [[ "$store" == "mysql" ]] && timeout=120

  header "Starting $store..."
  $COMPOSE --profile "$store" up -d --wait --wait-timeout "$timeout" 2>&1 | while read -r line; do dim "$line"; done
  ok "$store ready"
}

stop_store() {
  local store="$1"
  needs_docker "$store" || return 0
  dim "Stopping $store..."
  $COMPOSE --profile "$store" down 2>/dev/null || true
}

stop_all() {
  dim "Stopping all containers..."
  $COMPOSE --profile all down --remove-orphans 2>/dev/null || true
}

clean_store() {
  local store="$1"
  case "$store" in
    redis)     docker exec hitlimit-redis redis-cli FLUSHDB 2>/dev/null || true ;;
    postgres)  docker exec hitlimit-postgres psql -U hitlimit -d hitlimit_test \
                 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' 2>/dev/null || true ;;
    valkey)    docker exec hitlimit-valkey valkey-cli FLUSHDB 2>/dev/null || true ;;
    dragonfly) docker exec hitlimit-dragonfly redis-cli FLUSHDB 2>/dev/null || true ;;
    mongodb)   docker exec hitlimit-mongodb mongosh hitlimit_test \
                 --eval 'db.dropDatabase()' 2>/dev/null || true ;;
    mysql)     docker exec hitlimit-mysql mysqladmin -uhitlimit -phitlimit \
                 drop hitlimit_test -f 2>/dev/null
               docker exec hitlimit-mysql mysqladmin -uhitlimit -phitlimit \
                 create hitlimit_test 2>/dev/null || true ;;
  esac
}

# ── Results ─────────────────────────────────────────────────
count_results() {
  if [[ -d "$VERSION_DIR" ]]; then
    find "$VERSION_DIR" -name '*.json' 2>/dev/null | wc -l | tr -d ' '
  else
    echo "0"
  fi
}

result_exists() {
  [[ -f "$VERSION_DIR/$1.json" ]]
}

show_status() {
  local count
  count=$(count_results)

  header "Results status for v$VERSION"
  echo ""

  if [[ "$count" == "0" ]]; then
    warn "No results yet for v$VERSION"
  else
    ok "$count results found in results/v$VERSION/"
    echo ""

    for runtime in node bun; do
      local frameworks
      if [[ "$runtime" == "node" ]]; then
        frameworks="$NODE_FRAMEWORKS"
      else
        frameworks="$BUN_FRAMEWORKS"
      fi

      printf "  ${BOLD}%s${NC}\n" "$runtime"
      for fw in $frameworks; do
        local stores_done=""
        local stores_missing=""
        for store in $ALL_STORES; do
          local file="${runtime}-${fw}-hitlimit-${store}"
          if result_exists "$file"; then
            stores_done="$stores_done $store"
          else
            stores_missing="$stores_missing $store"
          fi
        done
        if [[ -n "$stores_done" ]]; then
          printf "    ${GREEN}%-10s${NC} done:%s\n" "$fw" "$stores_done"
        fi
        if [[ -n "$stores_missing" ]]; then
          printf "    ${DIM}%-10s todo:%s${NC}\n" "" "$stores_missing"
        fi
      done
      echo ""
    done
  fi

  # Show all versions
  if [[ -d "$RESULTS_DIR" ]]; then
    local versions
    versions=$(find "$RESULTS_DIR" -mindepth 1 -maxdepth 1 -type d -name 'v*' \
      -exec basename {} \; 2>/dev/null | sort -V)
    if [[ -n "$versions" ]]; then
      dim "All versions with results:"
      for v in $versions; do
        local c
        c=$(find "$RESULTS_DIR/$v" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
        if [[ "$v" == "v$VERSION" ]]; then
          printf "    ${BOLD}%s${NC} (%s results) ${CYAN}← current${NC}\n" "$v" "$c"
        else
          printf "    ${DIM}%s (%s results)${NC}\n" "$v" "$c"
        fi
      done
    fi
  fi
}

# ── Benchmark runner ────────────────────────────────────────
run_bench() {
  local runtime="$1" file="$2"
  local full_path="$BENCH_DIR/$file"

  if [[ ! -f "$full_path" ]]; then
    return 0
  fi

  dim "Running: $file"
  if [[ "$runtime" == "node" ]]; then
    NODE_OPTIONS='--expose-gc' npx tsx "$full_path" || true
  else
    bun "$full_path" || true
  fi
}

find_competitors() {
  local runtime="$1" framework="$2" store="$3"
  local base_dir="$BENCH_DIR/$runtime/$framework"

  if [[ -d "$base_dir" ]]; then
    for lib_dir in "$base_dir"/*/; do
      local lib_name
      lib_name="$(basename "$lib_dir")"
      [[ "$lib_name" == "hitlimit" ]] && continue
      if [[ -f "$lib_dir/$store.ts" ]]; then
        echo "$lib_name"
      fi
    done
  fi
}

run_store_benchmarks() {
  local store="$1"
  local skip_existing="${2:-false}"
  local no_competitors="${3:-false}"
  local count=0

  for runtime in node bun; do
    local frameworks
    if [[ "$runtime" == "node" ]]; then
      frameworks="$NODE_FRAMEWORKS"
    else
      frameworks="$BUN_FRAMEWORKS"
    fi

    for fw in $frameworks; do
      local file="${runtime}/${fw}/hitlimit/${store}.ts"
      local result_name="${runtime}-${fw}-hitlimit-${store}"

      if [[ ! -f "$BENCH_DIR/$file" ]]; then
        continue
      fi

      if $skip_existing && result_exists "$result_name"; then
        dim "Skip (exists): $result_name"
        continue
      fi

      run_bench "$runtime" "$file"
      count=$((count + 1))

      # Run competitors
      if ! $no_competitors; then
        local competitors
        competitors=$(find_competitors "$runtime" "$fw" "$store")
        for comp in $competitors; do
          if needs_docker "$store"; then
            clean_store "$store"
          fi
          run_bench "$runtime" "${runtime}/${fw}/${comp}/${store}.ts"
          count=$((count + 1))
        done
      fi
    done
  done

  echo "$count"
}

# ── Commands ────────────────────────────────────────────────

cmd_all() {
  local skip_existing=false
  local no_competitors=false

  for arg in "$@"; do
    case "$arg" in
      --skip-existing) skip_existing=true ;;
      --no-competitors) no_competitors=true ;;
    esac
  done

  local existing
  existing=$(count_results)
  if [[ "$existing" != "0" ]] && ! $skip_existing; then
    echo ""
    warn "$existing results already exist for v$VERSION"
    if confirm "Skip already-completed benchmarks?"; then
      skip_existing=true
    fi
  fi

  banner "FULL BENCHMARK SUITE — v$VERSION"

  header "Building packages..."
  pnpm build --silent 2>/dev/null || pnpm build
  echo ""

  cd "$BENCH_DIR"

  local total=0
  local start_time=$SECONDS

  # Phase 1: Local stores
  divider
  header "Phase 1: Local stores (no Docker)"
  divider

  for store in memory sqlite; do
    printf "\n"
    header "Benchmarking: $store"
    local c
    c=$(run_store_benchmarks "$store" "$skip_existing" "$no_competitors")
    total=$((total + c))
  done

  # Phase 2: Docker stores (isolated)
  divider
  printf "\n"
  header "Phase 2: Docker stores (isolated — one at a time)"
  divider
  stop_all

  for store in $DOCKER_STORES; do
    printf "\n"
    start_store "$store"

    local c
    c=$(run_store_benchmarks "$store" "$skip_existing" "$no_competitors")
    total=$((total + c))

    stop_store "$store"
  done

  # Summary
  local elapsed=$(( SECONDS - start_time ))
  local mins=$(( elapsed / 60 ))
  local secs=$(( elapsed % 60 ))
  local final_count
  final_count=$(count_results)

  printf "\n"
  divider
  banner "COMPLETE"
  ok "$total benchmarks executed in ${mins}m ${secs}s"
  ok "$final_count total results in results/v$VERSION/"
  divider
}

cmd_store() {
  local stores=("$@")
  local skip_existing=false
  local no_competitors=false
  local filtered_stores=()

  for arg in "${stores[@]}"; do
    case "$arg" in
      --skip-existing) skip_existing=true ;;
      --no-competitors) no_competitors=true ;;
      *) filtered_stores+=("$arg") ;;
    esac
  done

  if [[ ${#filtered_stores[@]} -eq 0 ]]; then
    pick_multi "Which stores to benchmark?" $ALL_STORES
    filtered_stores=("${PICK_RESULTS[@]}")
  fi

  banner "STORE BENCHMARK — v$VERSION"

  header "Building packages..."
  pnpm build --silent 2>/dev/null || pnpm build
  echo ""

  cd "$BENCH_DIR"
  stop_all

  local total=0
  local start_time=$SECONDS

  for store in "${filtered_stores[@]}"; do
    printf "\n"
    divider
    header "Benchmarking: $store"

    if needs_docker "$store"; then
      start_store "$store"
    fi

    local c
    c=$(run_store_benchmarks "$store" "$skip_existing" "$no_competitors")
    total=$((total + c))

    if needs_docker "$store"; then
      stop_store "$store"
    fi
  done

  local elapsed=$(( SECONDS - start_time ))
  local mins=$(( elapsed / 60 ))
  local secs=$(( elapsed % 60 ))

  printf "\n"
  divider
  ok "$total benchmarks executed in ${mins}m ${secs}s"
  divider
}

cmd_quick() {
  banner "QUICK BENCHMARK — v$VERSION (memory + sqlite)"

  header "Building packages..."
  pnpm build --silent 2>/dev/null || pnpm build
  echo ""

  cd "$BENCH_DIR"

  local total=0
  local start_time=$SECONDS

  for store in memory sqlite; do
    printf "\n"
    header "Benchmarking: $store"
    local c
    c=$(run_store_benchmarks "$store" false false)
    total=$((total + c))
  done

  local elapsed=$(( SECONDS - start_time ))
  local mins=$(( elapsed / 60 ))
  local secs=$(( elapsed % 60 ))

  printf "\n"
  divider
  ok "$total benchmarks executed in ${mins}m ${secs}s"
  divider
}

cmd_single() {
  banner "SINGLE BENCHMARK — v$VERSION"

  # Pick runtime
  pick_one "Select runtime:" node bun
  local runtime="$PICK_RESULT"

  # Pick framework
  if [[ "$runtime" == "node" ]]; then
    pick_one "Select framework:" $NODE_FRAMEWORKS
  else
    pick_one "Select framework:" $BUN_FRAMEWORKS
  fi
  local framework="$PICK_RESULT"

  # Pick store (only available ones)
  local available_stores=()
  for s in $ALL_STORES; do
    if [[ -f "$BENCH_DIR/$runtime/$framework/hitlimit/$s.ts" ]]; then
      available_stores+=("$s")
    fi
  done

  if [[ ${#available_stores[@]} -eq 0 ]]; then
    err "No benchmarks found for $runtime/$framework"
    exit 1
  fi

  pick_one "Select store:" "${available_stores[@]}"
  local store="$PICK_RESULT"

  # Competitors
  local competitors
  competitors=$(find_competitors "$runtime" "$framework" "$store")
  local include_comp=false
  if [[ -n "$competitors" ]]; then
    local comp_list
    comp_list=$(echo "$competitors" | tr '\n' ', ' | sed 's/,$//')
    if confirm "Include competitors? ($comp_list)"; then
      include_comp=true
    fi
  fi

  # Build
  header "Building packages..."
  pnpm build --silent 2>/dev/null || pnpm build
  echo ""

  cd "$BENCH_DIR"

  # Docker
  if needs_docker "$store"; then
    stop_all
    start_store "$store"
  fi

  # Run
  printf "\n"
  header "Running: $runtime / $framework / $store"
  run_bench "$runtime" "$runtime/$framework/hitlimit/$store.ts"

  if $include_comp; then
    for comp in $competitors; do
      clean_store "$store"
      run_bench "$runtime" "$runtime/$framework/$comp/$store.ts"
    done
  fi

  # Cleanup
  if needs_docker "$store"; then
    clean_store "$store"
    stop_store "$store"
  fi

  printf "\n"
  ok "Done!"
}

cmd_clean() {
  local target="${1:-}"

  header "Benchmark results cleanup"
  echo ""

  if [[ ! -d "$RESULTS_DIR" ]]; then
    warn "No results directory found"
    return 0
  fi

  local versions
  versions=$(find "$RESULTS_DIR" -mindepth 1 -maxdepth 1 -type d -name 'v*' \
    -exec basename {} \; 2>/dev/null | sort -V)

  if [[ -z "$versions" ]]; then
    warn "No version results found"
    return 0
  fi

  if [[ -n "$target" ]]; then
    local target_dir="$RESULTS_DIR/$target"
    if [[ -d "$target_dir" ]]; then
      local c
      c=$(find "$target_dir" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
      if confirm "Delete $c results from $target?"; then
        rm -rf "$target_dir"
        ok "Deleted $target"
      fi
    else
      err "Version $target not found"
    fi
    return 0
  fi

  # Interactive
  dim "Available versions:"
  echo ""
  local version_list=()
  for v in $versions; do
    local c
    c=$(find "$RESULTS_DIR/$v" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$v" == "v$VERSION" ]]; then
      printf "    ${BOLD}%s${NC} (%s results) ${CYAN}← current${NC}\n" "$v" "$c"
    else
      printf "    ${DIM}%s (%s results)${NC}\n" "$v" "$c"
    fi
    version_list+=("$v")
  done
  version_list+=("all-except-current" "cancel")

  pick_one "Which version to clean?" "${version_list[@]}"

  case "$PICK_RESULT" in
    cancel) return 0 ;;
    all-except-current)
      for v in $versions; do
        [[ "$v" == "v$VERSION" ]] && continue
        rm -rf "$RESULTS_DIR/$v"
        ok "Deleted $v"
      done
      ;;
    *)
      local dir="$RESULTS_DIR/$PICK_RESULT"
      if [[ -d "$dir" ]]; then
        rm -rf "$dir"
        ok "Deleted $PICK_RESULT"
      fi
      ;;
  esac
}

cmd_compare() {
  header "Regression check"
  echo ""

  cd "$BENCH_DIR"
  npx tsx check-regression.ts
}

# ── Usage ───────────────────────────────────────────────────
usage() {
  cat <<EOF

${BOLD}  hitlimit benchmark suite${NC}

${BOLD}  Usage:${NC}
    ./benchmarks/benchmark-all.sh [command] [options]

${BOLD}  Commands:${NC}
    ${CYAN}all${NC}                  Run ALL benchmarks (full suite, Docker isolated)
    ${CYAN}store${NC} [names...]     Run all frameworks for specific store(s)
    ${CYAN}quick${NC}                Run memory + sqlite only (no Docker)
    ${CYAN}single${NC}               Interactive single benchmark picker
    ${CYAN}status${NC}               Show which benchmarks exist for current version
    ${CYAN}clean${NC} [version]      Clean benchmark results
    ${CYAN}compare${NC}              Compare latest two versions (regression check)

${BOLD}  Options:${NC}
    --skip-existing      Skip benchmarks that already have results
    --no-competitors     Skip competitor library benchmarks

${BOLD}  Examples:${NC}
    ${DIM}./benchmarks/benchmark-all.sh${NC}                          Interactive menu
    ${DIM}./benchmarks/benchmark-all.sh all${NC}                      Full suite
    ${DIM}./benchmarks/benchmark-all.sh all --skip-existing${NC}      Resume interrupted run
    ${DIM}./benchmarks/benchmark-all.sh store redis postgres${NC}     Specific stores only
    ${DIM}./benchmarks/benchmark-all.sh quick${NC}                    Memory + SQLite only
    ${DIM}./benchmarks/benchmark-all.sh single${NC}                   Pick one benchmark
    ${DIM}./benchmarks/benchmark-all.sh status${NC}                   View results
    ${DIM}./benchmarks/benchmark-all.sh clean${NC}                    Clean old results
    ${DIM}./benchmarks/benchmark-all.sh compare${NC}                  Check regressions

EOF
  exit 0
}

# ── Main ────────────────────────────────────────────────────

COMMAND="${1:-}"

# No args = interactive menu
if [[ -z "$COMMAND" ]]; then
  printf "\n${BOLD}  hitlimit benchmark suite${NC}  ${DIM}v$VERSION${NC}\n"

  existing=$(count_results)
  if [[ "$existing" != "0" ]]; then
    dim "$existing results already exist for v$VERSION"
  fi

  pick_one "What would you like to do?" \
    "Run ALL benchmarks (full suite)" \
    "Run by store (pick stores)" \
    "Quick run (memory + sqlite)" \
    "Run single benchmark" \
    "View results status" \
    "Clean old results" \
    "Compare versions (regression check)"

  case "$PICK_RESULT" in
    "Run ALL benchmarks (full suite)") cmd_all ;;
    "Run by store (pick stores)")      cmd_store ;;
    "Quick run (memory + sqlite)")     cmd_quick ;;
    "Run single benchmark")            cmd_single ;;
    "View results status")             show_status ;;
    "Clean old results")               cmd_clean ;;
    "Compare versions (regression check)") cmd_compare ;;
  esac
  exit 0
fi

# Named commands
shift || true
case "$COMMAND" in
  all)     cmd_all "$@" ;;
  store)   cmd_store "$@" ;;
  quick)   cmd_quick ;;
  single)  cmd_single ;;
  status)  show_status ;;
  clean)   cmd_clean "$@" ;;
  compare) cmd_compare ;;
  --help|-h|help) usage ;;
  *) err "Unknown command: $COMMAND"; usage ;;
esac
