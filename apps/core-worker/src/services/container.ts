import type { CoreEnv } from "../contracts/environment";
import { nowUnixSeconds } from "../lib/time";
import { EconomicEngineV1 } from "../pricing/economic-engine";
import { InCodePricingRuleProvider } from "../pricing/rule-provider";
import { D1CheckoutSessionRepository } from "../repositories/checkout-session-repository";
import { D1LegalEntityRepository } from "../repositories/legal-entity-repository";
import { D1PaymentIntentRepository } from "../repositories/payment-intent-repository";
import { D1QuoteRepository } from "../repositories/quote-repository";
import type {
  CheckoutSessionRepository,
  LegalEntityRepository,
  PaymentIntentRepository,
  QuoteRepository,
} from "../repositories/types";
import { CoreCheckoutSessionService } from "./checkout-session-service";
import {
  NoopDomainEventPublisher,
  QueueDomainEventSink,
  SinkBackedDomainEventPublisher,
  type DomainEventPublisher,
} from "./domain-event-publisher";
import { CorePaymentIntentService } from "./payment-intent-service";
import { CoreQuoteService } from "./quote-service";
import type { CoreServices } from "./types";

export interface ServiceContainerDependencies {
  payment_intent_repository: PaymentIntentRepository;
  legal_entity_repository: LegalEntityRepository;
  quote_repository: QuoteRepository;
  checkout_session_repository: CheckoutSessionRepository;
  domain_event_publisher: DomainEventPublisher;
  now: () => number;
}

export function createRuntimeDependencies(env: CoreEnv): ServiceContainerDependencies {
  const paymentIntentRepository = new D1PaymentIntentRepository(env.DB);
  const legalEntityRepository = new D1LegalEntityRepository(env.DB);
  const quoteRepository = new D1QuoteRepository(env.DB);
  const checkoutSessionRepository = new D1CheckoutSessionRepository(env.DB);

  return {
    payment_intent_repository: paymentIntentRepository,
    legal_entity_repository: legalEntityRepository,
    quote_repository: quoteRepository,
    checkout_session_repository: checkoutSessionRepository,
    // Domain events are intentionally routed to a dedicated internal stream.
    // Delivery command publishing remains separate by design.
    domain_event_publisher: env.Q_DOMAIN_EVENTS
      ? new SinkBackedDomainEventPublisher(new QueueDomainEventSink(env.Q_DOMAIN_EVENTS))
      : new NoopDomainEventPublisher(),
    now: nowUnixSeconds,
  };
}

export function createServices(
  env: CoreEnv,
  dependencies: ServiceContainerDependencies,
): CoreServices {
  const pricingRules = new InCodePricingRuleProvider();
  const economicEngine = new EconomicEngineV1(pricingRules, dependencies.now);

  return {
    payment_intents: new CorePaymentIntentService(
      dependencies.payment_intent_repository,
      dependencies.legal_entity_repository,
      dependencies.domain_event_publisher,
      dependencies.now,
    ),
    quotes: new CoreQuoteService(
      dependencies.quote_repository,
      dependencies.payment_intent_repository,
      dependencies.domain_event_publisher,
      economicEngine,
      dependencies.now,
    ),
    checkout_sessions: new CoreCheckoutSessionService(
      dependencies.checkout_session_repository,
      dependencies.payment_intent_repository,
      dependencies.quote_repository,
      dependencies.domain_event_publisher,
      dependencies.now,
      env.ENVIRONMENT,
    ),
  };
}
