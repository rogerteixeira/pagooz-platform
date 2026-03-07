# Setup Runbook

## Prerequisites
- Node.js 20+
- npm 10+
- Wrangler CLI authenticated for the target account

## Install
1. `npm install`
2. `npm run verify:repo`

## Local bootstrap
- `scripts/bootstrap_environment.sh local`

This performs:
- repository structure/config checks
- local D1 migration apply via `wrangler/core.toml`

## Environment bootstrap
For `dev`, `staging`, `prod`:
- `scripts/bootstrap_environment.sh <env>`

Optional full bootstrap + deploy:
- `scripts/bootstrap_environment.sh <env> deploy`

## Migrations
Direct migration commands:
- `scripts/apply_migrations.sh local`
- `scripts/apply_migrations.sh dev`
- `scripts/apply_migrations.sh staging`
- `scripts/apply_migrations.sh prod`

## Running workers locally
- `npm run dev:core`
- `npm run dev:ledger`
- `npm run dev:notification`
- or `npm run run:local`

## Deployment
- `scripts/deploy_workers.sh dev`
- `scripts/deploy_workers.sh staging`
- `scripts/deploy_workers.sh prod`

Optional single worker deploy:
- `scripts/deploy_workers.sh dev core`
- `scripts/deploy_workers.sh staging ledger`
- `scripts/deploy_workers.sh prod notification`

## Validation checklist
Before deploy:
1. `npm run verify:repo`
2. `npm exec tsc --noEmit`
3. `npm test`
4. apply migrations for target env
