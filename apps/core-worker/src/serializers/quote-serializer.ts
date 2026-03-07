import type { Quote } from "../contracts/resources";
import { parseJsonObject } from "../lib/json";

export interface QuoteView {
  id: string;
  tenant_id: string;
  mode: "sandbox" | "live";
  payment_intent_id: string;
  payment_method: string;
  installments: number;
  payer_total: number;
  payer_currency: string;
  receiver_net: number;
  receiver_currency: string;
  fx: Record<string, unknown> | null;
  breakdown: Record<string, unknown> | null;
  rule_set_id: string | null;
  rule_set_version: number | null;
  expires_at: number;
  signature: string;
  created_at: number;
}

export function serializeQuote(quote: Quote): QuoteView {
  return {
    id: quote.id,
    tenant_id: quote.tenant_id,
    mode: quote.mode,
    payment_intent_id: quote.payment_intent_id,
    payment_method: quote.payment_method,
    installments: quote.installments,
    payer_total: quote.payer_total,
    payer_currency: quote.payer_currency,
    receiver_net: quote.receiver_net,
    receiver_currency: quote.receiver_currency,
    fx: parseJsonObject(quote.fx_json),
    breakdown: parseJsonObject(quote.breakdown_json),
    rule_set_id: quote.rule_set_id,
    rule_set_version: quote.rule_set_version,
    expires_at: quote.expires_at,
    signature: quote.signature,
    created_at: quote.created_at,
  };
}
