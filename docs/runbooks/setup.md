# Developer Setup Runbook

## Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account + API token

## Setup

1. `npm install`
2. `npx wrangler login`
3. Fill real D1 `database_id` values in:
   - `wrangler/core.toml`
   - `wrangler/ledger.toml`
   - `wrangler/notification.toml`

## Validate structure

- `npm run verify:repo`

## Bootstrap by environment

- local: `npm run bootstrap:local`
- dev: `npm run bootstrap:dev`
- staging: `npm run bootstrap:staging`
- prod: `npm run bootstrap:prod`

## Apply migrations

- local: `npm run migrate:local`
- dev: `npm run migrate:dev`
- staging: `npm run migrate:staging`
- prod: `npm run migrate:prod`

## Run local workers

- one command: `npm run run:local`
- optional separate processes:
  - `npm run dev:core`
  - `npm run dev:ledger`
  - `npm run dev:notification`

## Deploy

- dev: `npm run deploy:dev`
- staging: `npm run deploy:staging`
- prod: `npm run deploy:prod`
