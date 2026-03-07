#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENVIRONMENT="${1:-local}"

case "$ENVIRONMENT" in
  local)
    ENV_ARGS=()
    LOCATION_FLAG="--local"
    ;;
  dev|staging|prod)
    ENV_ARGS=(--env "$ENVIRONMENT")
    LOCATION_FLAG="--remote"
    ;;
  *)
    echo "Usage: $0 [local|dev|staging|prod]"
    exit 1
    ;;
esac

echo "Applying D1 migrations using wrangler/core.toml for environment: $ENVIRONMENT"
wrangler d1 migrations apply DB --config wrangler/core.toml "${ENV_ARGS[@]}" "$LOCATION_FLAG"
