#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENVIRONMENT="${1:-}"
WORKER_FILTER="${2:-all}"
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
  echo "Usage: $0 [dev|staging|prod] [all|core|ledger|notification]"
  exit 1
fi

if [[ "$WORKER_FILTER" != "all" && "$WORKER_FILTER" != "core" && "$WORKER_FILTER" != "ledger" && "$WORKER_FILTER" != "notification" ]]; then
  echo "Usage: $0 [dev|staging|prod] [all|core|ledger|notification]"
  exit 1
fi

scripts/verify_structure.sh

workers=(core ledger notification)
for worker in "${workers[@]}"; do
  if [[ "$WORKER_FILTER" != "all" && "$WORKER_FILTER" != "$worker" ]]; then
    continue
  fi

  cfg="wrangler/${worker}.toml"
  if [[ ! -f "$cfg" ]]; then
    echo "Missing wrangler config: $cfg"
    exit 1
  fi

  echo "Deploying ${worker} (${ENVIRONMENT})"
  wrangler deploy --config "$cfg" --env "$ENVIRONMENT"
done

echo "Deployment complete for environment: ${ENVIRONMENT}"
