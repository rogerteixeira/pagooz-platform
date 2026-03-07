# Environments and Modes

## Purpose
This document defines the canonical environment and mode model for Pagooz and how infrastructure resources are named.

## Infrastructure Environments
- `local`: developer machine and local Wrangler runtime
- `dev`: shared online development environment
- `staging`: homologation / QA environment
- `prod`: production environment

The environment model is fixed. `test` is not used.

## Business Modes
- `sandbox`
- `live`

Modes are business contexts, not infrastructure environments. The same API surface supports both modes with strict isolation.

## Resource Naming
Queue names are environment-suffixed:
- `q-ledger-commands-{env}`
- `q-domain-events-{env}`
- `q-notification-outbox-{env}`
- `q-webhook-outbox-{env}`
- `q-ledger-events-{env}`

D1 database names are environment-specific (`pagooz_d1_local`, `pagooz_d1_dev`, `pagooz_d1_staging`, `pagooz_d1_prod`).

## Isolation Constraints
- Every business write includes `tenant_id` and `mode`.
- Every business read is filtered by `tenant_id` and `mode`.
- Cross-mode reads/writes are rejected by design.

## Release Progression
Expected promotion path:
- `local` -> `dev` -> `staging` -> `prod`

Each promotion must pass:
- repository verification
- tests
- migration checks
- deployment checks
