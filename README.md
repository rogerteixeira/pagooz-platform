# Pagooz Platform

<<<<<<< HEAD
Pagooz is a fintech infrastructure platform with a hybrid worker architecture:
=======
## 1. Overview
Pagooz is a cross-border payments infrastructure platform built on Cloudflare Workers.
>>>>>>> 620ce06 (fix: restore worker dependency lifecycle and strict ledger typing)

This repository contains the execution foundation and backend modules for:
- API orchestration
- quote economics
- ledger posting commands and accounting persistence
- notification/webhook processing

## 2. Architecture Overview
Pagooz uses a hybrid worker architecture:

- `Core Worker`: API surface, request validation, tenant/mode enforcement, pricing, quote creation, and command publishing.
- `Ledger Worker`: consumes `ledger.post_entries`, validates balanced journals, enforces idempotency, persists journals/entries, updates balances, emits ledger events.
- `Notification Worker`: consumes delivery-focused commands for notifications and webhooks.

Shared platform primitives:
- Cloudflare D1 for operational state
- Cloudflare Queues for asynchronous commands/events
- R2 for artifacts and notification assets

## 3. Environment Model
Infrastructure environments:
- `local`
- `dev`
- `staging`
- `prod`

Business modes (independent from environment):
- `sandbox`
- `live`

Every business-facing query and write path is scoped by `tenant_id` and `mode`.

## 4. Local Development
### Prerequisites
- Node.js 20+
- npm 10+
- Wrangler CLI

### Setup
1. `npm install`
2. `npm run verify:repo`
3. `scripts/bootstrap_environment.sh local`

### Run workers
- `npm run dev:core`
- `npm run dev:ledger`
- `npm run dev:notification`
- or `npm run run:local`

## 5. Repository Layout
- `apps/core-worker/` Core API, middleware, pricing engine, repositories, services
- `apps/ledger-worker/` ledger command consumer and accounting persistence
- `apps/notification-worker/` notification and webhook delivery processing
- `packages/shared/` shared contracts (`event-envelope`, `ledger-command`)
- `wrangler/` environment-specific worker configuration and migrations
- `scripts/` bootstrap, migration, deploy, verification, roadmap helpers
- `docs/` engineering documentation

## 6. Testing
- `npm run verify:repo` validates repository structure and config consistency.
- `npm test` runs Vitest suites (Core and Ledger worker foundations).
- `npm exec tsc --noEmit` performs TypeScript type checking.

## 7. Deployment Overview
Standard sequence per environment (`dev`, `staging`, `prod`):
1. `scripts/bootstrap_environment.sh <env>`
2. `scripts/deploy_workers.sh <env>`

`bootstrap_environment.sh` runs structure checks and D1 migrations before deployment.

## 8. Security Practices
- Tenant + mode isolation is mandatory on business routes.
- Required scopes are enforced via route metadata.
- Operational bypass is explicit and constrained (`platform_admin` + route flag).
- Idempotency keys are required for write endpoints.
- No secrets are stored in the repository; use environment-specific secret management.
