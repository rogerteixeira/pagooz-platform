-- migrations/0001_init.sql
-- Pagooz D1 Schema v1 (SQLite / Cloudflare D1)
-- Notes:
-- - "mode" is Stripe-like: 'sandbox' | 'live' enforced by middleware and required on all business data.
-- - Ledger is append-only (enforced at app layer; schema supports immutability by convention).
-- - Timestamps stored as INTEGER (unix seconds). You can store ms if you prefer; be consistent.

PRAGMA foreign_keys = ON;

-- =========================
-- 0) ENUM-LIKE CHECKS
-- =========================
-- SQLite doesn't have enums. We'll enforce via CHECK constraints.

-- =========================
-- 1) TENANT & LEGAL STRUCTURE
-- =========================

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  default_locale TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS legal_entities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,                 -- ISO 3166-1 alpha-2 recommended
  tax_profile TEXT,                      -- JSON string (optional)
  reporting_currency TEXT NOT NULL,       -- e.g., USD, BRL
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  legal_entity_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  currency TEXT NOT NULL,
  country TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('bank','wallet')),
  provider TEXT,                         -- e.g., bank name, provider id
  label TEXT,                            -- friendly name
  details_json TEXT,                     -- encrypted/tokenized at app layer if sensitive
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE
);

-- =========================
-- 2) AUTH & RBAC
-- =========================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,                    -- if using password auth; otherwise null for SSO
  mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK (mfa_enabled IN (0,1)),
  locale TEXT,                           -- e.g., en, pt-BR
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL,
  UNIQUE (tenant_id, email),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (tenant_id, name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE               -- e.g., "fees.override.link"
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT,
  key_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  environment TEXT NOT NULL DEFAULT 'prod' CHECK (environment IN ('dev','test','staging','prod')),
  scopes_json TEXT,                      -- JSON array of scopes
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  metadata_json TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  mode TEXT CHECK (mode IN ('sandbox','live')),
  user_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system','user','api_key','provider')),
  actor_id TEXT,
  action TEXT NOT NULL,                  -- e.g., "fx_batch.execute"
  entity_type TEXT,
  entity_id TEXT,
  reason TEXT,                           -- required for sensitive actions (enforced in app)
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

-- =========================
-- 3) PRICING / RULE SETS / TAX RULES
-- =========================

CREATE TABLE IF NOT EXISTS pricing_rule_sets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  version INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  created_at INTEGER NOT NULL,
  UNIQUE (tenant_id, mode, version),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Corridor config: one row per corridor pair inside a rule set
CREATE TABLE IF NOT EXISTS corridor_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  rule_set_id TEXT NOT NULL,
  source_country TEXT NOT NULL,
  target_country TEXT NOT NULL,
  source_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  fx_provider TEXT,                      -- e.g., awesomeapi, frankfurter, providerX
  fx_markup_percent REAL NOT NULL DEFAULT 0.0,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_set_id) REFERENCES pricing_rule_sets(id) ON DELETE CASCADE
);

-- Service fees and general fee policy per rule set
CREATE TABLE IF NOT EXISTS fee_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  rule_set_id TEXT NOT NULL,
  service_fee_percent REAL NOT NULL DEFAULT 0.0,
  service_fee_fixed INTEGER NOT NULL DEFAULT 0,      -- cents in the policy currency context (use per-currency rules if needed)
  service_fee_min INTEGER,                            -- optional
  service_fee_max INTEGER,                            -- optional
  default_fee_strategy_json TEXT,                     -- JSON of absorb/pass defaults
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_set_id) REFERENCES pricing_rule_sets(id) ON DELETE CASCADE
);

-- MDR per payment method / installments
CREATE TABLE IF NOT EXISTS mdr_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  rule_set_id TEXT NOT NULL,
  payment_method TEXT NOT NULL,                       -- pix, card_debit, card_credit, boleto, ach, etc.
  installments INTEGER NOT NULL DEFAULT 1,
  percent REAL NOT NULL DEFAULT 0.0,
  fixed INTEGER NOT NULL DEFAULT 0,
  min INTEGER,
  max INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_set_id) REFERENCES pricing_rule_sets(id) ON DELETE CASCADE
);

-- Advance fee per settlement term (D+X)
CREATE TABLE IF NOT EXISTS advance_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  rule_set_id TEXT NOT NULL,
  settlement_term TEXT NOT NULL,                      -- e.g., D+0, D+1, D+2, D+30
  percent REAL NOT NULL DEFAULT 0.0,
  fixed INTEGER NOT NULL DEFAULT 0,
  min INTEGER,
  max INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_set_id) REFERENCES pricing_rule_sets(id) ON DELETE CASCADE
);

-- Taxes (e.g., IOF) rules by corridor/method/nature - kept generic
CREATE TABLE IF NOT EXISTS tax_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  rule_set_id TEXT NOT NULL,
  tax_type TEXT NOT NULL,                              -- IOF, VAT, etc.
  percent REAL NOT NULL DEFAULT 0.0,
  fixed INTEGER NOT NULL DEFAULT 0,
  applies_to_json TEXT,                                -- JSON condition: corridor/method/entity/etc.
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_set_id) REFERENCES pricing_rule_sets(id) ON DELETE CASCADE
);

-- =========================
-- 4) PAYMENTS CORE (INTENTS / QUOTES / CHECKOUT / PAYMENTS)
-- =========================

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  -- The initiating legal entity (where the intent is anchored for initial collection)
  legal_entity_id TEXT NOT NULL,
  amount INTEGER NOT NULL,                              -- receiver wants NET in receiver currency units (cents)
  currency TEXT NOT NULL,                               -- receiver currency
  payer_country TEXT,                                   -- ISO country (optional until known)
  settlement_term TEXT NOT NULL DEFAULT 'D+2',
  status TEXT NOT NULL CHECK (status IN ('created','quoted','processing','authorized','captured','settled','failed','cancelled')),
  -- fee_strategy & metadata
  fee_strategy_json TEXT,                               -- requested/allowed overrides
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  payment_intent_id TEXT NOT NULL,
  payment_method TEXT NOT NULL,                         -- pix, card, boleto, etc.
  installments INTEGER NOT NULL DEFAULT 1,
  payer_total INTEGER NOT NULL,                          -- what payer pays (cents in payer currency)
  payer_currency TEXT NOT NULL,
  receiver_net INTEGER NOT NULL,                         -- net to be distributed (cents in receiver currency)
  receiver_currency TEXT NOT NULL,
  fx_json TEXT,                                          -- rate, provider, timestamp, markup, corridor
  breakdown_json TEXT NOT NULL,                           -- fees/taxes breakdown
  rule_set_id TEXT,
  rule_set_version INTEGER,
  expires_at INTEGER NOT NULL,
  signature TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  payment_intent_id TEXT NOT NULL,
  quote_id TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL CHECK (status IN ('created','active','completed','expired','cancelled')),
  url TEXT,                                              -- optional storage
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id) ON DELETE CASCADE,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  payment_intent_id TEXT NOT NULL,
  quote_id TEXT,
  provider TEXT NOT NULL,                                -- pix/card/acquirer/etc.
  provider_reference TEXT,                               -- masked/redacted per policy
  status TEXT NOT NULL CHECK (status IN ('created','authorized','captured','settled','failed','refunded','disputed')),
  amount INTEGER NOT NULL,                               -- final payer amount (cents)
  currency TEXT NOT NULL,                                -- payer currency
  captured_at INTEGER,
  settled_at INTEGER,
  raw_provider_json TEXT,                                -- optional (careful with PII)
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id) ON DELETE CASCADE,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL
);

-- Useful for analytics and troubleshooting; optional but recommended
CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  payment_id TEXT NOT NULL,
  event_type TEXT NOT NULL,                              -- payment.succeeded etc.
  data_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

-- =========================
-- 5) SPLIT (CROSS-ENTITY ALLOCATIONS)
-- =========================

CREATE TABLE IF NOT EXISTS split_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  payment_id TEXT NOT NULL,
  basis TEXT NOT NULL DEFAULT 'receiver_net' CHECK (basis IN ('receiver_net','payer_total')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS split_recipients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  split_plan_id TEXT NOT NULL,
  legal_entity_id TEXT NOT NULL,
  percent REAL,                                          -- nullable
  fixed_amount INTEGER,                                  -- nullable (cents in payout_currency)
  payout_currency TEXT NOT NULL,
  settlement_term TEXT NOT NULL DEFAULT 'D+2',
  payout_route_preference TEXT CHECK (payout_route_preference IN ('local','fx','direct')) DEFAULT 'fx',
  created_at INTEGER NOT NULL,
  CHECK (
    (percent IS NOT NULL AND fixed_amount IS NULL) OR
    (percent IS NULL AND fixed_amount IS NOT NULL)
  ),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (split_plan_id) REFERENCES split_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE RESTRICT
);

-- =========================
-- 6) TREASURY & FX (MULTI-ROUTE)
-- =========================

CREATE TABLE IF NOT EXISTS fx_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  legal_entity_id TEXT NOT NULL,                         -- the entity that owns the source funds
  source_currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','routes_defined','sent','executed','settled','closed','cancelled')),
  created_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fx_batch_routes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  batch_id TEXT NOT NULL,
  route_type TEXT NOT NULL CHECK (route_type IN ('official_fx','stablecoin','direct_payout','internal_netting')),
  target_currency TEXT NOT NULL,
  amount_source INTEGER NOT NULL,                         -- amount in source currency (cents)
  provider TEXT,
  tax_mode TEXT NOT NULL DEFAULT 'n/a',                    -- 'iof_applicable', 'country_rules', 'n/a'
  expected_cost_json TEXT,                                -- percent/fixed estimates
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','sent','executed','settled','failed','cancelled')),
  executed_rate_json TEXT,                                -- effective FX info
  provider_reference TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES fx_batches(id) ON DELETE CASCADE
);

-- Which payments (or split allocations) are funded by which route
-- For v1, we link to payment_id; later you can link to payout_schedule_id for granular treasury funding.
CREATE TABLE IF NOT EXISTS fx_batch_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  route_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  amount_source INTEGER NOT NULL,                          -- in source currency (cents)
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES fx_batch_routes(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

-- =========================
-- 7) PAYOUTS (SCHEDULES + EXECUTION)
-- =========================

CREATE TABLE IF NOT EXISTS payout_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  -- who receives the payout (destination is tied to a legal entity)
  legal_entity_id TEXT NOT NULL,
  recipient_legal_entity_id TEXT NOT NULL,                -- recipient entity (can be same or another)
  currency TEXT NOT NULL,
  amount INTEGER NOT NULL,
  settlement_term TEXT NOT NULL DEFAULT 'D+2',
  status TEXT NOT NULL CHECK (status IN ('scheduled','ready','processing','paid','failed','cancelled')),
  scheduled_for INTEGER,
  source_reference_type TEXT,                              -- payment | split_recipient | fx_route | manual
  source_reference_id TEXT,
  destination_bank_account_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE RESTRICT,
  FOREIGN KEY (recipient_legal_entity_id) REFERENCES legal_entities(id) ON DELETE RESTRICT,
  FOREIGN KEY (destination_bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  payout_schedule_id TEXT NOT NULL,
  provider TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('created','sent','paid','failed')),
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (payout_schedule_id) REFERENCES payout_schedules(id) ON DELETE CASCADE
);

-- =========================
-- 8) LEDGER (APPEND-ONLY)
-- =========================

-- Predefined account types. You can extend as needed.
-- account_type examples: clearing_local, clearing_foreign, fx_pending, provider_cost, pagooz_revenue, merchant_balance, operational_cost, tax_payable, reserve
CREATE TABLE IF NOT EXISTS balance_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  legal_entity_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  account_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (tenant_id, mode, legal_entity_id, currency, account_type),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE
);

-- Current balance snapshot per account (optional but recommended for fast reads)
CREATE TABLE IF NOT EXISTS account_balances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  account_id TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE (tenant_id, mode, account_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES balance_accounts(id) ON DELETE CASCADE
);

-- Journals are a group of entries; enforced idempotency by journal_id
CREATE TABLE IF NOT EXISTS ledger_journals (
  id TEXT PRIMARY KEY,                                    -- journal_id
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  legal_entity_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  reference_type TEXT NOT NULL,                           -- payment | fx_route | payout | refund | manual
  reference_id TEXT NOT NULL,
  posted_at INTEGER NOT NULL,
  UNIQUE (tenant_id, mode, id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  legal_entity_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  journal_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0)),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE RESTRICT,
  FOREIGN KEY (journal_id) REFERENCES ledger_journals(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES balance_accounts(id) ON DELETE RESTRICT
);

-- =========================
-- 9) TIMELINE (POLISHED, SCOPE-BASED)
-- =========================

CREATE TABLE IF NOT EXISTS timeline_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  scope TEXT NOT NULL CHECK (scope IN ('superadmin','business','consumer')),
  entity_type TEXT NOT NULL,                              -- payment | payout | fx_batch | checkout_session
  entity_id TEXT NOT NULL,
  step TEXT NOT NULL,                                     -- e.g., payment_confirmed
  title_key TEXT NOT NULL,
  message_key TEXT NOT NULL,
  message_vars_json TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- =========================
-- 10) WEBHOOKS (CONFIG + DELIVERY LOGS)
-- =========================

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  url TEXT NOT NULL,
  secret_hash TEXT NOT NULL,                              -- store hash; secret returned only once at creation
  event_types_json TEXT NOT NULL,                         -- JSON array
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled','disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  endpoint_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending','delivered','failed','retry_scheduled','dead_lettered')),
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  next_attempt_at INTEGER,
  request_headers_json TEXT,
  response_headers_json TEXT,
  response_body_snippet TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  UNIQUE (tenant_id, mode, endpoint_id, event_id, attempt),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE CASCADE
);

-- =========================
-- 11) NOTIFICATIONS (PREFERENCES + DELIVERY LOGS)
-- =========================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  scope TEXT NOT NULL CHECK (scope IN ('business','consumer','superadmin')),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  event_type TEXT NOT NULL,                               -- payment.succeeded, payout.paid, etc.
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  recipients_json TEXT,                                   -- JSON list of emails/phones; consumer usually set at runtime
  locale TEXT,                                            -- optional override
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  UNIQUE (tenant_id, mode, scope, channel, event_type),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
  scope TEXT NOT NULL CHECK (scope IN ('business','consumer','superadmin')),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  template_key TEXT NOT NULL,
  locale TEXT NOT NULL,
  to_address TEXT NOT NULL,                               -- email or phone (masked in logs if needed)
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','delivered','failed','retry_scheduled','dead_lettered')),
  attempt INTEGER NOT NULL DEFAULT 1,
  provider TEXT,
  provider_reference TEXT,
  error_code TEXT,
  error_message TEXT,
  next_attempt_at INTEGER,
  resources_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  UNIQUE (tenant_id, mode, dedupe_key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- =========================
-- 12) EVENT DEDUPE (FOR CONSUMERS)
-- =========================

-- Each consumer (ledger-worker, notify-worker, timeline-builder) records processed events.
CREATE TABLE IF NOT EXISTS processed_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  mode TEXT CHECK (mode IN ('sandbox','live')),
  consumer_name TEXT NOT NULL,                            -- e.g., "ledger-worker"
  event_id TEXT NOT NULL,
  processed_at INTEGER NOT NULL,
  UNIQUE (consumer_name, event_id)
);

-- =========================
-- 13) OPTIONAL: FX RATE CACHE (QUOTES / PROVIDERS)
-- =========================

CREATE TABLE IF NOT EXISTS fx_rate_cache (
  id TEXT PRIMARY KEY,                                    -- e.g., "BRL:USD"
  tenant_id TEXT,                                         -- optional; if per-tenant corridors
  mode TEXT CHECK (mode IN ('sandbox','live')),
  pair TEXT NOT NULL,                                     -- "BRL/USD"
  provider TEXT NOT NULL,
  rate REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  raw_json TEXT
);

-- Done.