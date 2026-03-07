#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_paths=(
  "README.md"
  "package.json"
  "tsconfig.json"
  "apps/core-worker/src/index.ts"
  "apps/ledger-worker/src/index.ts"
  "apps/notification-worker/src/index.ts"
  "packages/shared/src/contracts/ledger-command.ts"
  "docs/openapi/v1.yaml"
  "docs/events/v1.md"
  "docs/i18n/keys.md"
  "prompts/MASTER.md"
  "wrangler/core.toml"
  "wrangler/ledger.toml"
  "wrangler/notification.toml"
  "wrangler/migrations/0001_init.sql"
  "wrangler/migrations/0002_indexes.sql"
  "scripts/bootstrap_environment.sh"
  "scripts/run_local_workers.sh"
)

failed=0

for path in "${required_paths[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "ERROR: missing required path: $path"
    failed=1
  fi
done

for worker_entry in \
  "apps/core-worker/src/http/routes.ts" \
  "apps/ledger-worker/src/index.ts" \
  "apps/notification-worker/src/index.ts"; do
  for endpoint in '/health' '/ready' '/version'; do
    if ! rg -q "\"${endpoint}\"" "$worker_entry"; then
      echo "ERROR: missing endpoint ${endpoint} in $worker_entry"
      failed=1
    fi
  done
done

for cfg in wrangler/core.toml wrangler/ledger.toml wrangler/notification.toml; do
  cfg_dir="$(dirname "$cfg")"
  main_path="$(awk -F '"' '/^main = / { print $2; exit }' "$cfg")"

  if [[ -z "$main_path" || ! -f "$cfg_dir/$main_path" ]]; then
    echo "ERROR: invalid entrypoint in $cfg -> $main_path"
    failed=1
  fi

  if ! rg -q 'migrations_dir = "\./migrations"' "$cfg"; then
    echo "ERROR: missing migrations_dir in $cfg"
    failed=1
  fi

  for env in dev staging prod; do
    if ! rg -q "^\[env\.${env}\]" "$cfg"; then
      echo "ERROR: missing [env.${env}] in $cfg"
      failed=1
    fi
  done

  if rg -q '^\[env\.test\]' "$cfg"; then
    echo "ERROR: found stale [env.test] in $cfg"
    failed=1
  fi
done

for env in local dev staging prod; do
  for queue in \
    "q-ledger-commands-${env}" \
    "q-domain-events-${env}" \
    "q-notification-outbox-${env}" \
    "q-webhook-outbox-${env}"; do
    if ! rg -q "queue = \"${queue}\"" wrangler/core.toml; then
      echo "ERROR: missing ${queue} in wrangler/core.toml"
      failed=1
    fi
  done

  for queue in \
    "q-ledger-commands-${env}" \
    "q-ledger-events-${env}"; do
    if ! rg -q "queue = \"${queue}\"" wrangler/ledger.toml; then
      echo "ERROR: missing ${queue} in wrangler/ledger.toml"
      failed=1
    fi
  done

  for queue in \
    "q-notification-outbox-${env}" \
    "q-webhook-outbox-${env}"; do
    if ! rg -q "queue = \"${queue}\"" wrangler/notification.toml; then
      echo "ERROR: missing ${queue} in wrangler/notification.toml"
      failed=1
    fi
  done
done

if rg -q 'q-app-bus-' wrangler/core.toml wrangler/ledger.toml wrangler/notification.toml; then
  echo "ERROR: found placeholder queue names (q-app-bus-*) in wrangler configs"
  failed=1
fi

if rg -n '\[env\.test\]|ENVIRONMENT = "test"|pagooz_d1_test|<local\|test\|staging\|prod>' \
  README.md docs/environments.md docs/repository-structure.md docs/runbooks/setup.md prompts/MASTER.md \
  scripts/apply_migrations.sh scripts/deploy_workers.sh scripts/bootstrap_environment.sh \
  wrangler/*.toml wrangler/README.md package.json >/tmp/pagooz_stale_test_refs.txt 2>/dev/null; then
  echo "ERROR: found stale 'test' environment references:"
  cat /tmp/pagooz_stale_test_refs.txt
  failed=1
fi

if stray_files="$(rg --files -g '*.bak' -g '*.orig' -g '*.tmp' -g 'verify_structure.shu')"; then
  if [[ -n "$stray_files" ]]; then
    echo "ERROR: found unexpected stray files:"
    echo "$stray_files"
    failed=1
  fi
fi

if [[ "$failed" -ne 0 ]]; then
  echo "Repository verification failed."
  exit 1
fi

echo "Repository verification passed."
