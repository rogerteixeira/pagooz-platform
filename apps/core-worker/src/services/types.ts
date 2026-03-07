import type { Mode } from "../contracts/environment";
import type {
  CheckoutSession,
  JsonObject,
  PaymentIntent,
  Quote,
} from "../contracts/resources";

export interface CreatePaymentIntentPayload {
  legal_entity_id: string;
  amount: number;
  currency: string;
  payer_country?: string;
  settlement_term?: string;
  fee_strategy?: JsonObject;
  metadata?: JsonObject;
}

export interface PaymentIntentService {
  create(tenant_id: string, mode: Mode, payload: CreatePaymentIntentPayload): Promise<PaymentIntent>;
  getById(tenant_id: string, mode: Mode, id: string): Promise<PaymentIntent | null>;
  list(
    tenant_id: string,
    mode: Mode,
    options: { limit: number; status?: string },
  ): Promise<PaymentIntent[]>;
}

export interface CreateQuotePayload {
  payment_intent_id: string;
  payment_method: string;
  installments?: number;
}

export interface QuoteService {
  create(tenant_id: string, mode: Mode, payload: CreateQuotePayload): Promise<Quote>;
  getById(tenant_id: string, mode: Mode, id: string): Promise<Quote | null>;
}

export interface CreateCheckoutSessionPayload {
  payment_intent_id: string;
  quote_id?: string;
  locale?: string;
  expires_in_seconds?: number;
}

export interface CheckoutSessionService {
  create(tenant_id: string, mode: Mode, payload: CreateCheckoutSessionPayload): Promise<CheckoutSession>;
  getById(tenant_id: string, mode: Mode, id: string): Promise<CheckoutSession | null>;
  list(
    tenant_id: string,
    mode: Mode,
    options: { limit: number; status?: string },
  ): Promise<CheckoutSession[]>;
}

export interface CoreServices {
  payment_intents: PaymentIntentService;
  quotes: QuoteService;
  checkout_sessions: CheckoutSessionService;
}
