# Pagooz Environments & Modes

## 1. Infrastructure Environments

Pagooz operates with exactly four infrastructure environments:

- local
- dev
- staging
- prod

Each environment has:

- Dedicated Cloudflare Workers
- Dedicated D1 database
- Dedicated Queue names
- Dedicated R2 buckets

### Worker names

- pagooz-core-{env}
- pagooz-ledger-{env}
- pagooz-notification-{env}

### D1 names

- pagooz_d1_local
- pagooz_d1_dev
- pagooz_d1_staging
- pagooz_d1_prod

### Queue names

- q-ledger-commands-{env}
- q-domain-events-{env}
- q-ledger-events-{env}
- q-notification-outbox-{env}
- q-webhook-outbox-{env}

### R2 bucket names

- pagooz-artifacts-{env}
- pagooz-notification-assets-{env}

### Wrangler source of truth

- wrangler/core.toml
- wrangler/ledger.toml
- wrangler/notification.toml
- wrangler/migrations/0001_init.sql
- wrangler/migrations/0002_indexes.sql

---

## 2. Business Mode (Stripe-like)

Each tenant operates in:

- sandbox
- live

Mode is enforced by:

- API key
- Dashboard session
- Middleware injection

Every business table MUST include:

- tenant_id
- mode (sandbox | live)

All business queries MUST filter by:

WHERE tenant_id = ? AND mode = ?

Sandbox and live data must never mix.

---

## 3. Domains

Production:
- api.pagooz.com
- dashboard.pagooz.com
- checkout.pagooz.com

Staging:
- api-staging.pagooz.com
- dashboard-staging.pagooz.com
- checkout-staging.pagooz.com

Development:
- dev-api.pagooz.com
- dev-dashboard.pagooz.com
- dev-checkout.pagooz.com

---

## 4. Rules

- Dev never connects to staging or prod database.
- Staging never connects to prod database.
- Sandbox keys cannot access live mode.
- Live keys cannot access sandbox mode.
- Mode toggle must preserve state in URL.
- Queue/R2 resources must always use environment suffixes.
