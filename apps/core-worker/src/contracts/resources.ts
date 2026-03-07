import type { Mode } from "./environment";

export type PaymentIntentStatus =
  | "created"
  | "quoted"
  | "processing"
  | "authorized"
  | "captured"
  | "settled"
  | "failed"
  | "cancelled";

export interface PaymentIntent {
  id: string;
  tenant_id: string;
  mode: Mode;
  legal_entity_id: string;
  amount: number;
  currency: string;
  payer_country: string | null;
  settlement_term: string;
  status: PaymentIntentStatus;
  fee_strategy_json: string | null;
  metadata_json: string | null;
  created_at: number;
  updated_at: number | null;
}

export interface Quote {
  id: string;
  tenant_id: string;
  mode: Mode;
  payment_intent_id: string;
  payment_method: string;
  installments: number;
  payer_total: number;
  payer_currency: string;
  receiver_net: number;
  receiver_currency: string;
  fx_json: string | null;
  breakdown_json: string;
  rule_set_id: string | null;
  rule_set_version: number | null;
  expires_at: number;
  signature: string;
  created_at: number;
}

export type CheckoutSessionStatus =
  | "created"
  | "active"
  | "completed"
  | "expired"
  | "cancelled";

export interface CheckoutSession {
  id: string;
  tenant_id: string;
  mode: Mode;
  payment_intent_id: string;
  quote_id: string | null;
  locale: string;
  status: CheckoutSessionStatus;
  url: string | null;
  expires_at: number;
  created_at: number;
}

export interface JsonObject {
  [key: string]: unknown;
}
