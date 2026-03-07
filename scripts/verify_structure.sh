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

for queue_binding in Q_LEDGER_COMMANDS Q_DOMAIN_EVENTS Q_NOTIFICATION_OUTBOX Q_WEBHOOK_OUTBOX; do
  if ! rg -q "binding = \"${queue_binding}\"" wrangler/core.toml; then
    echo "ERROR: missing core queue producer binding ${queue_binding} in wrangler/core.toml"
    failed=1
  fi
done

if rg -n 'scripts/wrangler|migrations/(0001_init.sql|0002_indexes.sql)' README.md docs prompts package.json scripts --glob '!scripts/verify_structure.sh' | rg -v 'wrangler/migrations' >/tmp/pagooz_legacy_refs.txt 2>/dev/null; then
  echo "ERROR: found legacy path references:"
  cat /tmp/pagooz_legacy_refs.txt
  failed=1
fi

if rg -n '\[env\.test\]|ENVIRONMENT = "test"|pagooz_d1_test|q-[a-z-]+-test|pagooz-[a-z-]+-test|<local\|test\|staging\|prod>' \
  README.md docs/environments.md docs/repository-structure.md docs/runbooks/setup.md prompts/MASTER.md \
  scripts/apply_migrations.sh scripts/deploy_workers.sh scripts/bootstrap_environment.sh \
  wrangler/*.toml wrangler/README.md package.json >/tmp/pagooz_stale_test_refs.txt 2>/dev/null; then
  echo "ERROR: found stale 'test' environment references:"
  cat /tmp/pagooz_stale_test_refs.txt
  failed=1
fi

if rg -n 'queue = "q-[^"]+"' wrangler/*.toml | rg -v '(local|dev|staging|prod)"' >/tmp/pagooz_bad_queues.txt 2>/dev/null; then
  echo "ERROR: queue names must be environment-suffixed:"
  cat /tmp/pagooz_bad_queues.txt
  failed=1
fi

if rg -n 'bucket_name = "pagooz-[^"]+"' wrangler/*.toml | rg -v '(local|dev|staging|prod)"' >/tmp/pagooz_bad_buckets.txt 2>/dev/null; then
  echo "ERROR: bucket names must be environment-suffixed:"
  cat /tmp/pagooz_bad_buckets.txt
  failed=1
fi

if rg -n 'database_name = "pagooz_d1_[^"]+"' wrangler/*.toml | rg -v '(local|dev|staging|prod)"' >/tmp/pagooz_bad_db_names.txt 2>/dev/null; then
  echo "ERROR: D1 database names must be environment-suffixed:"
  cat /tmp/pagooz_bad_db_names.txt
  failed=1
fi

if rg -n 'ENVIRONMENT = "' wrangler/*.toml | rg -v 'ENVIRONMENT = "(local|dev|staging|prod)"' >/tmp/pagooz_bad_env_names.txt 2>/dev/null; then
  echo "ERROR: found invalid ENVIRONMENT values in wrangler configs:"
  cat /tmp/pagooz_bad_env_names.txt
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  echo "Repository verification failed."
  exit 1
fi

echo "Repository verification passed."
