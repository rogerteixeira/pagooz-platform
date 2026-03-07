import type { Mode } from "../contracts/environment";
import type { JsonObject } from "../contracts/resources";
import { notFound } from "../http/errors";
import { generateId } from "../lib/ids";
import { parseJsonObject } from "../lib/json";
import type { EconomicEngineV1 } from "../pricing/economic-engine";
import type { FeeAbsorption } from "../pricing/types";
import type { PaymentIntentRepository, QuoteRepository } from "../repositories/types";
import type { DomainEventPublisher } from "./domain-event-publisher";
import type { CreateQuotePayload } from "./types";

function parseFeeAbsorption(value: unknown): FeeAbsorption {
  if (typeof value === "string" && value.trim().toLowerCase() === "merchant") {
    return "merchant";
  }

  return "payer";
}

function normalizeCountry(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length === 2) {
    return value.trim().toUpperCase();
  }

  return fallback;
}

function normalizeCurrency(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length === 3) {
    return value.trim().toUpperCase();
  }

  return fallback;
}

function asObject(value: Record<string, unknown> | null): JsonObject | null {
  if (!value) {
    return null;
  }

  return value as JsonObject;
}

export class CoreQuoteService {
  constructor(
    private readonly quoteRepository: QuoteRepository,
    private readonly paymentIntentRepository: PaymentIntentRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly economicEngine: EconomicEngineV1,
    private readonly now: () => number,
  ) {}

  async create(tenant_id: string, mode: Mode, payload: CreateQuotePayload) {
    const paymentIntent = await this.paymentIntentRepository.getById(
      tenant_id,
      mode,
      payload.payment_intent_id,
    );

    if (!paymentIntent) {
      throw notFound("payment_intent_not_found", "PaymentIntent not found.");
    }

    const feeStrategy = parseJsonObject(paymentIntent.fee_strategy_json);
    const feeAbsorption = parseFeeAbsorption(
      feeStrategy?.absorption ?? feeStrategy?.absorbed_by,
    );

    const payerCountry = normalizeCountry(
      paymentIntent.payer_country ?? feeStrategy?.payer_country,
      "US",
    );
    const receiverCountry = normalizeCountry(feeStrategy?.receiver_country, payerCountry);
    const payerCurrency = normalizeCurrency(feeStrategy?.payer_currency, paymentIntent.currency);
    const receiverCurrency = paymentIntent.currency;
    const corridorCode = `${payerCountry}->${receiverCountry}:${payerCurrency}/${receiverCurrency}`;

    const pricingResult = await this.economicEngine.quote({
      tenant_id,
      mode,
      payment_intent: paymentIntent,
      payment_method: payload.payment_method,
      installments: payload.installments ?? 1,
      settlement_term: paymentIntent.settlement_term,
      corridor: {
        payer_country: payerCountry,
        receiver_country: receiverCountry,
        payer_currency: payerCurrency,
        receiver_currency: receiverCurrency,
        corridor_code: corridorCode,
      },
      fee_strategy: {
        absorption: feeAbsorption,
        raw: asObject(feeStrategy),
      },
    });

    const created = await this.quoteRepository.create({
      id: generateId("qt"),
      tenant_id,
      mode,
      payment_intent_id: paymentIntent.id,
      payment_method: payload.payment_method,
      installments: payload.installments ?? 1,
      payer_total: pricingResult.payer_total,
      payer_currency: pricingResult.payer_currency,
      receiver_net: pricingResult.receiver_net,
      receiver_currency: pricingResult.receiver_currency,
      fx_json: JSON.stringify(pricingResult.fx),
      breakdown_json: JSON.stringify({
        fee_breakdown: pricingResult.fee_breakdown,
        tax_breakdown: pricingResult.tax_breakdown,
        applied_rule_summary: pricingResult.applied_rule_summary,
        signature_input_base: pricingResult.signature_input_base,
      }),
      rule_set_id: pricingResult.applied_rule_summary.rule_set_id,
      rule_set_version: pricingResult.applied_rule_summary.rule_set_version,
      expires_at: pricingResult.expires_at,
      signature: pricingResult.signature,
      created_at: this.now(),
    });

    await this.domainEventPublisher.publishResourceCreated({
      event_type: "quote.created",
      tenant_id,
      mode,
      resource_type: "quote",
      resource_id: created.id,
      data: {
        quote_id: created.id,
        payment_intent_id: created.payment_intent_id,
        payer_total: created.payer_total,
      },
    });

    return created;
  }

  async getById(tenant_id: string, mode: Mode, id: string) {
    return this.quoteRepository.getById(tenant_id, mode, id);
  }
}
