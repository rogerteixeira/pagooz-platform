import type { PaymentIntent } from "../contracts/resources";
import { parseJsonObject } from "../lib/json";

export interface PaymentIntentView {
  id: string;
  tenant_id: string;
  mode: "sandbox" | "live";
  legal_entity_id: string;
  amount: number;
  currency: string;
  payer_country: string | null;
  settlement_term: string;
  status: string;
  fee_strategy: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: number;
  updated_at: number | null;
}

export function serializePaymentIntent(intent: PaymentIntent): PaymentIntentView {
  return {
    id: intent.id,
    tenant_id: intent.tenant_id,
    mode: intent.mode,
    legal_entity_id: intent.legal_entity_id,
    amount: intent.amount,
    currency: intent.currency,
    payer_country: intent.payer_country,
    settlement_term: intent.settlement_term,
    status: intent.status,
    fee_strategy: parseJsonObject(intent.fee_strategy_json),
    metadata: parseJsonObject(intent.metadata_json),
    created_at: intent.created_at,
    updated_at: intent.updated_at,
  };
}

export function serializePaymentIntentList(intents: PaymentIntent[]): PaymentIntentView[] {
  return intents.map(serializePaymentIntent);
}
