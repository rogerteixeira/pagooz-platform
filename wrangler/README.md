# Wrangler Configuration

This directory contains the Cloudflare Worker configuration used by Pagooz environments.

## Files
- `core.toml`: Core Worker runtime, bindings, and environment overrides
- `ledger.toml`: Ledger Worker runtime, queue consumer/producer bindings
- `notification.toml`: Notification Worker runtime and delivery queue consumers
- `migrations/`: canonical D1 migrations shared across workers

## Conventions
- Environment model is fixed: `local`, `dev`, `staging`, `prod`.
- All queue names are environment-suffixed.
- D1 migrations are sourced from `wrangler/migrations` via `migrations_dir = "./migrations"`.
- Worker entrypoints are referenced relative to each TOML file.

## Workflow
- Local development uses `wrangler dev --config wrangler/<worker>.toml`.
- Migrations are applied through `scripts/apply_migrations.sh`.
- Deployments are executed by `scripts/deploy_workers.sh <env>`.
