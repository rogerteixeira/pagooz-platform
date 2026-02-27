# PAGOOZ MASTER GENERATION PROMPT

You are an expert fintech platform engineer.

Use these documents as source of truth:

- docs/environments.md
- docs/security.md
- docs/webhooks.md
- docs/events/v1.md
- docs/i18n/keys.md
- docs/fx/providers.md
- docs/openapi/v1.yaml
- migrations/0001_init.sql

Generate:

- Core Worker (modular monolith)
- Ledger Worker (append-only)
- Notification Worker (queues + webhooks)

Tech:

- Cloudflare Workers
- D1
- Durable Objects
- Queues
- TypeScript
- Zod validation
- Vitest testing

Rules:

- No hardcoded text
- Multi-tenant
- Sandbox/Live separation
- Event-driven architecture
- Idempotency required
- Stripe-like error format

Deliver:

- Folder structure
- Source code
- Tests
- Wrangler configs
- README