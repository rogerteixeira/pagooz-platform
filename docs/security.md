# Security Model

## Scope
This document describes request-level and service-level security constraints used by the platform foundation.

## Authentication and Actor Resolution
Core middleware resolves actor identity from:
- API key headers (current scaffold)
- JWT headers (placeholder scaffold)

Resolved actor context includes:
- authentication method
- tenant binding (when available)
- roles
- scopes

## Authorization and RBAC
Route metadata defines:
- `requires_auth`
- `required_scopes`
- `allow_operational_bypass`

Rules:
- required scopes are enforced on protected routes
- operational bypass is allowed only when both are true:
  - `allow_operational_bypass == true`
  - actor role contains `platform_admin`
- generic `admin` role does not bypass scope checks

## Tenant and Mode Isolation
Business handlers require:
- `tenant_id`
- `mode` (`sandbox` or `live`)

Repositories and services always receive tenant/mode explicitly.

## Idempotency
Write endpoints require `idempotency-key` and reject missing values.

## Queue and Event Separation
- domain events and delivery commands use separate queues
- ledger commands are validated before posting
- invalid ledger commands are rejected without partial persistence

## Data and Secrets Hygiene
- no credentials committed to source control
- environment-specific secrets managed outside the repo
- logs/events should not include sensitive credential material
