#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
  echo "Usage: $0 [dev|staging|prod]"
  exit 1
fi

for worker in core ledger notification; do
  echo "Deploying $worker ($ENVIRONMENT)"
  wrangler deploy --config "wrangler/${worker}.toml" --env "$ENVIRONMENT"
done
