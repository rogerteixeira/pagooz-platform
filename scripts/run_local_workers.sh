#!/usr/bin/env bash
set -euo pipefail

pids=()

cleanup() {
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

npm run dev:core &
pids+=("$!")

npm run dev:ledger &
pids+=("$!")

npm run dev:notification &
pids+=("$!")

wait "${pids[@]}"
