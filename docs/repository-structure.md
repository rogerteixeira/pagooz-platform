# Repository Structure

## Top-level layout
- `apps/`: worker applications (`core-worker`, `ledger-worker`, `notification-worker`).
- `packages/`: shared types/contracts used across workers.
- `wrangler/`: worker configuration per app and shared migration files.
- `scripts/`: bootstrap, migration, deployment, and verification automation.
- `docs/`: engineering documentation.

## App responsibilities
### `apps/core-worker/`
- HTTP routing and middleware pipeline
- validation and error handling
- tenant/mode/auth/scope enforcement
- payment_intent, quote, checkout_session modules
- economic engine integration
- domain event publishing and ledger command publishing

### `apps/ledger-worker/`
- consumes `ledger.post_entries` commands
- validates journal shape and balance rules
- enforces idempotency by journal identity
- auto-provisions accounts
- persists `ledger_journals` and `ledger_entries`
- updates `account_balances`
- emits `ledger.journal_posted` / `ledger.journal_rejected`

### `apps/notification-worker/`
- consumes notification/webhook outbox queues
- handles delivery-oriented workflows

## Shared contracts
`packages/shared/src/contracts/` contains cross-worker contracts:
- `event-envelope.ts`
- `ledger-command.ts`

These contracts define queue payload compatibility between producers and consumers.

## Infrastructure configuration
`wrangler/*.toml` is the source of truth for:
- worker entrypoints
- queue bindings (producer/consumer)
- D1 bindings and migration directory
- environment-specific names (`local`, `dev`, `staging`, `prod`)

## Documentation intent
Engineering docs in this repository are implementation-oriented and should remain aligned with actual code and configuration.
