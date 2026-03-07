-- Pagooz D1 Indexes v1
-- Focus: performance for multi-tenant + mode + ledger-heavy workloads

PRAGMA foreign_keys = ON;

-- =========================
-- TENANT / ENTITY LOOKUPS
-- =========================

CREATE INDEX IF NOT EXISTS idx_legal_entities_tenant
ON legal_entities (tenant_id);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant_mode
ON bank_accounts (tenant_id, mode);

-- =========================
-- AUTH / API
-- =========================

CREATE INDEX IF NOT EXISTS idx_users_tenant
ON users (tenant_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_mode
ON api_keys (tenant_id, mode);

CREATE INDEX IF NOT EXISTS idx_sessions_user
ON sessions (user_id);

-- =========================
-- PAYMENT CORE (VERY IMPORTANT)
-- =========================

CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant_mode
ON payment_intents (tenant_id, mode);

CREATE INDEX IF NOT EXISTS idx_payment_intents_status
ON payment_intents (status);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_mode
ON payments (tenant_id, mode);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments (status);

CREATE INDEX IF NOT EXISTS idx_payments_intent
ON payments (payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_quotes_intent
ON quotes (payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_intent
ON checkout_sessions (payment_intent_id);

-- =========================
-- SPLIT
-- =========================

CREATE INDEX IF NOT EXISTS idx_split_plans_payment
ON split_plans (payment_id);

CREATE INDEX IF NOT EXISTS idx_split_recipients_entity
ON split_recipients (legal_entity_id);

-- =========================
-- FX & TREASURY
-- =========================

CREATE INDEX IF NOT EXISTS idx_fx_batches_entity
ON fx_batches (legal_entity_id);

CREATE INDEX IF NOT EXISTS idx_fx_batches_status
ON fx_batches (status);

CREATE INDEX IF NOT EXISTS idx_fx_routes_batch
ON fx_batch_routes (batch_id);

CREATE INDEX IF NOT EXISTS idx_fx_items_route
ON fx_batch_items (route_id);

CREATE INDEX IF NOT EXISTS idx_payout_schedules_entity
ON payout_schedules (legal_entity_id);

CREATE INDEX IF NOT EXISTS idx_payout_schedules_status
ON payout_schedules (status);

CREATE INDEX IF NOT EXISTS idx_payouts_schedule
ON payouts (payout_schedule_id);

-- =========================
-- LEDGER (CRITICAL HOT PATH)
-- =========================

-- Query by entity + currency (balance lookups)
CREATE INDEX IF NOT EXISTS idx_ledger_entity_currency
ON ledger_entries (legal_entity_id, currency);

-- Query by journal
CREATE INDEX IF NOT EXISTS idx_ledger_journal
ON ledger_entries (journal_id);

-- Query by reference (payment, payout, fx)
CREATE INDEX IF NOT EXISTS idx_ledger_reference
ON ledger_entries (reference_type, reference_id);

-- Account balances quick lookup
CREATE INDEX IF NOT EXISTS idx_account_balances_account
ON account_balances (account_id);

-- =========================
-- TIMELINE (UI HOT PATH)
-- =========================

CREATE INDEX IF NOT EXISTS idx_timeline_entity
ON timeline_entries (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_timeline_scope
ON timeline_entries (scope);

CREATE INDEX IF NOT EXISTS idx_timeline_tenant_mode
ON timeline_entries (tenant_id, mode);

-- =========================
-- WEBHOOKS & NOTIFICATIONS
-- =========================

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant_mode
ON webhook_endpoints (tenant_id, mode);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
ON webhook_deliveries (endpoint_id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event
ON webhook_deliveries (event_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_tenant_mode
ON notification_deliveries (tenant_id, mode);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status
ON notification_deliveries (status);

-- =========================
-- EVENT DEDUPE
-- =========================

CREATE INDEX IF NOT EXISTS idx_processed_events_consumer
ON processed_events (consumer_name);

-- =========================
-- FX CACHE
-- =========================

CREATE INDEX IF NOT EXISTS idx_fx_rate_pair
ON fx_rate_cache (pair);

-- Done