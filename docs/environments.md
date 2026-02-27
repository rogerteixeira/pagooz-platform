# Pagooz Environments & Modes

## 1. Infrastructure Environments

We operate with four infrastructure environments:

- local
- test (CI)
- staging
- production

Each environment has:

- Dedicated Cloudflare Workers
- Dedicated D1 database
- Dedicated R2 bucket
- Dedicated Queue bindings

### Worker naming convention

- pagooz-core-{env}
- pagooz-ledger-{env}
- pagooz-notify-{env}

### D1 naming

- pagooz_d1_staging
- pagooz_d1_prod

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

All queries MUST filter by:

WHERE tenant_id = ? AND mode = ?

Sandbox and Live data must NEVER mix.

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

---

## 4. Rules

- Staging never connects to prod database.
- Sandbox keys cannot access live mode.
- Live keys cannot access sandbox mode.
- Mode toggle must preserve state in URL.