#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-local}"

case "$ENVIRONMENT" in
  local|dev|staging|prod)
    ;;
  *)
    echo "Usage: $0 [local|dev|staging|prod]"
    exit 1
    ;;
esac

echo "Bootstrapping Pagooz environment: $ENVIRONMENT"

scripts/verify_structure.sh

if [[ "$ENVIRONMENT" == "local" ]]; then
  scripts/apply_migrations.sh local
  echo "Local bootstrap complete."
  exit 0
fi

for queue in \
  "q-ledger-commands-${ENVIRONMENT}" \
  "q-domain-events-${ENVIRONMENT}" \
  "q-ledger-events-${ENVIRONMENT}" \
  "q-notification-outbox-${ENVIRONMENT}" \
  "q-webhook-outbox-${ENVIRONMENT}"; do
  wrangler queues create "$queue" || true
done

for bucket in \
  "pagooz-artifacts-${ENVIRONMENT}" \
  "pagooz-notification-assets-${ENVIRONMENT}"; do
  wrangler r2 bucket create "$bucket" || true
done

echo "Environment resources ensured for $ENVIRONMENT."
echo "Next step: scripts/apply_migrations.sh $ENVIRONMENT"
