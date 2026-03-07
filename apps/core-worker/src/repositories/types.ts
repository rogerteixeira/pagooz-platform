import type { Mode } from "../contracts/environment";
import type {
  CheckoutSession,
  PaymentIntent,
  Quote,
} from "../contracts/resources";

export interface PaymentIntentListOptions {
  limit: number;
  status?: string;
}

export interface CheckoutSessionListOptions {
  limit: number;
  status?: string;
}

export interface LegalEntityRecord {
  id: string;
  tenant_id: string;
  status: "active" | "suspended";
}

export interface LegalEntityRepository {
  getByIdForTenant(
    tenant_id: string,
    legal_entity_id: string,
  ): Promise<LegalEntityRecord | null>;
}

export interface CreatePaymentIntentInput {
  id: string;
  tenant_id: string;
  mode: Mode;
  legal_entity_id: string;
  amount: number;
  currency: string;
  payer_country: string | null;
  settlement_term: string;
  status: PaymentIntent["status"];
  fee_strategy_json: string | null;
  metadata_json: string | null;
  created_at: number;
}

export interface PaymentIntentRepository {
  create(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  getById(tenant_id: string, mode: Mode, id: string): Promise<PaymentIntent | null>;
  list(
    tenant_id: string,
    mode: Mode,
    options: PaymentIntentListOptions,
  ): Promise<PaymentIntent[]>;
}

export interface CreateQuoteInput {
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

export interface QuoteRepository {
  create(input: CreateQuoteInput): Promise<Quote>;
  getById(tenant_id: string, mode: Mode, id: string): Promise<Quote | null>;
}

export interface CreateCheckoutSessionInput {
  id: string;
  tenant_id: string;
  mode: Mode;
  payment_intent_id: string;
  quote_id: string | null;
  locale: string;
  status: CheckoutSession["status"];
  url: string | null;
  expires_at: number;
  created_at: number;
}

export interface CheckoutSessionRepository {
  create(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;
  getById(tenant_id: string, mode: Mode, id: string): Promise<CheckoutSession | null>;
  list(
    tenant_id: string,
    mode: Mode,
    options: CheckoutSessionListOptions,
  ): Promise<CheckoutSession[]>;
}
