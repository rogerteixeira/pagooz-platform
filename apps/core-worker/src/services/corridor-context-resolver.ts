import type { JsonObject, PaymentIntent } from "../contracts/resources";
import type { LegalEntityRecord } from "../repositories/types";
import type { CorridorContext } from "../pricing/types";

export interface CorridorResolutionInput {
  payment_intent: PaymentIntent;
  legal_entity: LegalEntityRecord;
  explicit?: {
    payer_country?: string;
    payer_currency?: string;
    receiver_country?: string;
    receiver_currency?: string;
  };
  tenant_defaults?: JsonObject | null;
}

function normalizeCountry(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized.length !== 2) {
    return null;
  }

  return normalized;
}

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized.length !== 3) {
    return null;
  }

  return normalized;
}

export class CorridorContextResolver {
  resolve(input: CorridorResolutionInput): CorridorContext {
    const tenantDefaultCountry = normalizeCountry(input.tenant_defaults?.default_country);

    const payerCountry =
      normalizeCountry(input.explicit?.payer_country) ??
      normalizeCountry(input.payment_intent.payer_country) ??
      normalizeCountry(input.tenant_defaults?.payer_country) ??
      normalizeCountry(input.legal_entity.country) ??
      tenantDefaultCountry ??
      "US";

    const receiverCountry =
      normalizeCountry(input.explicit?.receiver_country) ??
      normalizeCountry(input.legal_entity.country) ??
      normalizeCountry(input.tenant_defaults?.receiver_country) ??
      tenantDefaultCountry ??
      payerCountry;

    const receiverCurrency =
      normalizeCurrency(input.explicit?.receiver_currency) ??
      normalizeCurrency(input.payment_intent.currency) ??
      normalizeCurrency(input.tenant_defaults?.receiver_currency) ??
      "USD";

    const payerCurrency =
      normalizeCurrency(input.explicit?.payer_currency) ??
      normalizeCurrency(input.tenant_defaults?.payer_currency) ??
      receiverCurrency;

    return {
      payer_country: payerCountry,
      receiver_country: receiverCountry,
      payer_currency: payerCurrency,
      receiver_currency: receiverCurrency,
      corridor_code: `${payerCountry}->${receiverCountry}:${payerCurrency}/${receiverCurrency}`,
    };
  }
}
