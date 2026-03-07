# Repository Structure (Source of Truth)

## Top-level

- `apps/`: Cloudflare Workers
- `packages/`: shared contracts and utilities
- `docs/`: platform source-of-truth docs
- `prompts/`: Codex prompts
- `scripts/`: operational scripts
- `wrangler/`: Cloudflare config + D1 migrations

## Worker ownership

- `apps/core-worker`: API orchestration + queue producers
- `apps/ledger-worker`: append-only ledger command consumer
- `apps/notification-worker`: notification + webhook outbox consumers

## Environment model

- infra environments: `local`, `dev`, `staging`, `prod`
- customer modes: `sandbox`, `live`

## Contracts and specs

- OpenAPI: `docs/openapi/v1.yaml`
- Event contracts: `docs/events/v1.md`
- i18n keys: `docs/i18n/keys.md`

## Migrations

- `wrangler/migrations/0001_init.sql`
- `wrangler/migrations/0002_indexes.sql`

Migrations are applied via the `DB` binding in `wrangler/core.toml`.
