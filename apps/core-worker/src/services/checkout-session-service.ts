import type { InfrastructureEnvironment, Mode } from "../contracts/environment";
import { invalidRequest, notFound } from "../http/errors";
import { generateId } from "../lib/ids";
import type {
  CheckoutSessionRepository,
  CheckoutSessionListOptions,
  PaymentIntentRepository,
  QuoteRepository,
} from "../repositories/types";
import type { DomainEventPublisher } from "./domain-event-publisher";
import type { CreateCheckoutSessionPayload } from "./types";

function checkoutBaseUrl(environment: InfrastructureEnvironment): string {
  switch (environment) {
    case "prod":
      return "https://checkout.pagooz.com";
    case "staging":
      return "https://checkout-staging.pagooz.com";
    case "dev":
      return "https://dev-checkout.pagooz.com";
    case "local":
      return "http://localhost:8787";
    default:
      return "http://localhost:8787";
  }
}

export class CoreCheckoutSessionService {
  constructor(
    private readonly repository: CheckoutSessionRepository,
    private readonly paymentIntentRepository: PaymentIntentRepository,
    private readonly quoteRepository: QuoteRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly now: () => number,
    private readonly environment: InfrastructureEnvironment,
  ) {}

  async create(tenant_id: string, mode: Mode, payload: CreateCheckoutSessionPayload) {
    const paymentIntent = await this.paymentIntentRepository.getById(
      tenant_id,
      mode,
      payload.payment_intent_id,
    );

    if (!paymentIntent) {
      throw notFound("payment_intent_not_found", "PaymentIntent not found.");
    }

    if (payload.quote_id) {
      const quote = await this.quoteRepository.getById(tenant_id, mode, payload.quote_id);
      if (!quote) {
        throw notFound("quote_not_found", "Quote not found.");
      }

      if (quote.payment_intent_id !== paymentIntent.id) {
        throw invalidRequest(
          "quote_payment_intent_mismatch",
          "Quote does not belong to this PaymentIntent.",
        );
      }
    }

    const id = generateId("cs");
    const expiresAt = this.now() + (payload.expires_in_seconds ?? 30 * 60);
    const locale = payload.locale ?? "en";

    const created = await this.repository.create({
      id,
      tenant_id,
      mode,
      payment_intent_id: paymentIntent.id,
      quote_id: payload.quote_id ?? null,
      locale,
      status: "created",
      url: `${checkoutBaseUrl(this.environment)}/session/${id}`,
      expires_at: expiresAt,
      created_at: this.now(),
    });

    await this.domainEventPublisher.publishResourceCreated({
      event_type: "checkout_session.created",
      tenant_id,
      mode,
      resource_type: "checkout_session",
      resource_id: created.id,
      data: {
        checkout_session_id: created.id,
        payment_intent_id: created.payment_intent_id,
        quote_id: created.quote_id,
      },
    });

    return created;
  }

  async getById(tenant_id: string, mode: Mode, id: string) {
    return this.repository.getById(tenant_id, mode, id);
  }

  async list(
    tenant_id: string,
    mode: Mode,
    options: CheckoutSessionListOptions,
  ) {
    return this.repository.list(tenant_id, mode, options);
  }
}
