# Wrangler Configs

This folder is the source of truth for Cloudflare configuration.

## Files

- `core.toml`: Core Worker (HTTP API + queue producers, including internal domain events stream)
- `ledger.toml`: Ledger Worker (queue consumer + ledger events producer)
- `notification.toml`: Notification Worker (queue consumers)
- `migrations/`: Shared D1 migrations (single schema for all workers)

## Environment Model

Each config includes:

- top-level = `local`
- `[env.dev]`
- `[env.staging]`
- `[env.prod]`

## Important

- Replace `database_id` placeholder UUIDs with real D1 IDs before remote deploy.
- Queue and R2 names are environment-suffixed to avoid cross-environment data leakage.
- Keep `migrations_dir = "./migrations"` in every `d1_databases` block.
