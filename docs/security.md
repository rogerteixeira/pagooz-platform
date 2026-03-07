# Pagooz Security Baseline v1

## Authentication

- JWT access token (15 min expiry)
- Refresh token rotation
- MFA required for dashboard users
- API Keys for server-to-server

## Authorization

- RBAC per tenant
- API key scopes
- Permission-based route protection
- Superadmin access strictly controlled

Current API scope model:
- `payment_intents:write`
- `payment_intents:read`
- `quotes:write`
- `quotes:read`
- `checkout_sessions:write`
- `checkout_sessions:read`

Policy note:
- `admin` role can bypass scope checks for operational access.

## Critical Operations (require audit log)

- Pricing changes
- Payout execution
- FX batch execution
- Split adjustments (before payment)
- Webhook endpoint changes

## Idempotency

All POST endpoints must require:

Idempotency-Key header

Idempotency is enforced via Durable Objects.

## Webhook Security

- HMAC-SHA256 signature
- Timestamp header
- Retry with exponential backoff
- Delivery logs stored
- Manual resend supported

## PII Handling

- Minimal storage
- Mask sensitive fields
- Redaction by scope:
  - Superadmin: full technical
  - Business: operational
  - Consumer: polished minimal

## Rate Limiting

Enforced per:
- Tenant
- IP
- Endpoint
