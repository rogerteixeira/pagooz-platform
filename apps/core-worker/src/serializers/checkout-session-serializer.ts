import type { CheckoutSession } from "../contracts/resources";

export interface CheckoutSessionView {
  id: string;
  tenant_id: string;
  mode: "sandbox" | "live";
  payment_intent_id: string;
  quote_id: string | null;
  status: string;
  locale: string;
  expires_at: number;
  url: string | null;
  created_at: number;
}

export function serializeCheckoutSession(session: CheckoutSession): CheckoutSessionView {
  return {
    id: session.id,
    tenant_id: session.tenant_id,
    mode: session.mode,
    payment_intent_id: session.payment_intent_id,
    quote_id: session.quote_id,
    status: session.status,
    locale: session.locale,
    expires_at: session.expires_at,
    url: session.url,
    created_at: session.created_at,
  };
}

export function serializeCheckoutSessionList(sessions: CheckoutSession[]): CheckoutSessionView[] {
  return sessions.map(serializeCheckoutSession);
}
