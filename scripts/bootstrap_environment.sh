#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENVIRONMENT="${1:-local}"
ACTION="${2:-migrate}"

case "$ENVIRONMENT" in
  local|dev|staging|prod)
    ;;
  *)
    echo "Usage: $0 [local|dev|staging|prod] [migrate|deploy]"
    exit 1
    ;;
esac

case "$ACTION" in
  migrate|deploy)
    ;;
  *)
    echo "Usage: $0 [local|dev|staging|prod] [migrate|deploy]"
    exit 1
    ;;
esac

echo "Running bootstrap checks for environment: $ENVIRONMENT"
scripts/verify_structure.sh
scripts/apply_migrations.sh "$ENVIRONMENT"

if [[ "$ENVIRONMENT" == "local" ]]; then
  echo "Local bootstrap complete (verification + migrations)."
  exit 0
fi

if [[ "$ACTION" == "deploy" ]]; then
  scripts/deploy_workers.sh "$ENVIRONMENT"
  echo "Bootstrap complete for ${ENVIRONMENT} (verification + migrations + deploy)."
  exit 0
fi

echo "Bootstrap complete for ${ENVIRONMENT} (verification + migrations)."
echo "Run deploy when ready: scripts/deploy_workers.sh ${ENVIRONMENT}"
