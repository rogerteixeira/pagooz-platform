# Pagooz Platform

Pagooz is a fintech infrastructure platform with a hybrid worker architecture:

- Core Worker (modular monolith)
- Ledger Worker (append-only, isolated)
- Notification Worker (email + webhooks via queues)

The platform is multi-tenant, multi-legal-entity, event-driven, and enforces strict `sandbox`/`live` customer mode isolation.

## Repository Layout

- `apps/`: worker code
- `packages/`: shared contracts
- `docs/`: source-of-truth platform docs
- `prompts/`: Codex prompt source
- `scripts/`: operational tooling
- `wrangler/`: Worker configs + D1 migrations

Canonical structure: `docs/repository-structure.md`

## Canonical Environment Model

Infrastructure environments:

- `local`
- `dev`
- `staging`
- `prod`

Customer operation modes:

- `sandbox`
- `live`

## Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account access
- Wrangler auth (`npx wrangler login`)

## Quick Start

1. `npm install`
2. `npm run verify:repo`
3. Replace placeholder D1 `database_id` values in `wrangler/*.toml`
4. `npm run bootstrap:local`
5. `npm run run:local`

## Environment Commands

Local:

- bootstrap: `npm run bootstrap:local`
- migrate: `npm run migrate:local`
- run all workers: `npm run run:local`

Dev:

- bootstrap: `npm run bootstrap:dev`
- migrate: `npm run migrate:dev`
- deploy: `npm run deploy:dev`

Staging:

- bootstrap: `npm run bootstrap:staging`
- migrate: `npm run migrate:staging`
- deploy: `npm run deploy:staging`

Prod:

- bootstrap: `npm run bootstrap:prod`
- migrate: `npm run migrate:prod`
- deploy: `npm run deploy:prod`

## Migrations

Canonical migration location:

- `wrangler/migrations/0001_init.sql`
- `wrangler/migrations/0002_indexes.sql`

Apply migrations via:

- `scripts/apply_migrations.sh <local|dev|staging|prod>`

## Notes

- Queue names and bucket names are environment-suffixed.
- Core domain events are published to `q-domain-events-{env}` and kept separate from delivery command queues.
- Worker health endpoints: `/health`, `/ready`, `/version`.
- `workers_dev = true` is used for bootstrap simplicity.

## Core API Foundation (Phase 2)

Implemented endpoints in Core Worker:

- `POST /v1/payment_intents`
- `GET /v1/payment_intents`
- `GET /v1/payment_intents/:id`
- `POST /v1/quotes`
- `GET /v1/quotes/:id`
- `POST /v1/checkout_sessions`
- `GET /v1/checkout_sessions`
- `GET /v1/checkout_sessions/:id`

Middleware foundation includes request tracing, tenant/mode enforcement, auth scaffold, RBAC scaffold, idempotency scaffold, locale resolution, and audit hook scaffold.

Quote creation now uses Economic Engine v1 with deterministic fee/tax breakdowns and quote signatures.

Test command:

- `npm test`
