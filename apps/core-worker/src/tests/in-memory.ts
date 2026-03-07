import type { CoreEnv } from "../contracts/environment";
import type {
  CheckoutSession,
  PaymentIntent,
  Quote,
} from "../contracts/resources";
import type {
  CheckoutSessionListOptions,
  CheckoutSessionRepository,
  CreateCheckoutSessionInput,
  CreatePaymentIntentInput,
  CreateQuoteInput,
  LegalEntityRecord,
  LegalEntityRepository,
  PaymentIntentListOptions,
  PaymentIntentRepository,
  QuoteRepository,
} from "../repositories/types";
import {
  NoopDomainEventPublisher,
  type DomainEventPublisher,
} from "../services/domain-event-publisher";
import type { ServiceContainerDependencies } from "../services/container";

export class InMemoryPaymentIntentRepository implements PaymentIntentRepository {
  private readonly records = new Map<string, PaymentIntent>();

  async create(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const record: PaymentIntent = {
      ...input,
      updated_at: null,
    };

    this.records.set(record.id, record);
    return record;
  }

  async getById(
    tenant_id: string,
    mode: "sandbox" | "live",
    id: string,
  ): Promise<PaymentIntent | null> {
    const record = this.records.get(id);
    if (!record) {
      return null;
    }

    if (record.tenant_id !== tenant_id || record.mode !== mode) {
      return null;
    }

    return record;
  }

  async list(
    tenant_id: string,
    mode: "sandbox" | "live",
    options: PaymentIntentListOptions,
  ): Promise<PaymentIntent[]> {
    const list = [...this.records.values()]
      .filter((record) => record.tenant_id === tenant_id && record.mode === mode)
      .filter((record) => (options.status ? record.status === options.status : true))
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, options.limit);

    return list;
  }
}

export class InMemoryQuoteRepository implements QuoteRepository {
  private readonly records = new Map<string, Quote>();

  async create(input: CreateQuoteInput): Promise<Quote> {
    const record: Quote = { ...input };
    this.records.set(record.id, record);
    return record;
  }

  async getById(
    tenant_id: string,
    mode: "sandbox" | "live",
    id: string,
  ): Promise<Quote | null> {
    const record = this.records.get(id);
    if (!record) {
      return null;
    }

    if (record.tenant_id !== tenant_id || record.mode !== mode) {
      return null;
    }

    return record;
  }
}

export class InMemoryCheckoutSessionRepository implements CheckoutSessionRepository {
  private readonly records = new Map<string, CheckoutSession>();

  async create(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    const record: CheckoutSession = { ...input };
    this.records.set(record.id, record);
    return record;
  }

  async getById(
    tenant_id: string,
    mode: "sandbox" | "live",
    id: string,
  ): Promise<CheckoutSession | null> {
    const record = this.records.get(id);
    if (!record) {
      return null;
    }

    if (record.tenant_id !== tenant_id || record.mode !== mode) {
      return null;
    }

    return record;
  }

  async list(
    tenant_id: string,
    mode: "sandbox" | "live",
    options: CheckoutSessionListOptions,
  ): Promise<CheckoutSession[]> {
    const list = [...this.records.values()]
      .filter((record) => record.tenant_id === tenant_id && record.mode === mode)
      .filter((record) => (options.status ? record.status === options.status : true))
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, options.limit);

    return list;
  }
}

export class InMemoryLegalEntityRepository implements LegalEntityRepository {
  private readonly entitiesByTenant = new Map<string, Map<string, LegalEntityRecord>>();

  constructor(seed?: Record<string, Array<{ id: string; status?: "active" | "suspended" }>>) {
    if (!seed) {
      return;
    }

    Object.entries(seed).forEach(([tenant, entityDefs]) => {
      const tenantEntities = new Map<string, LegalEntityRecord>();
      entityDefs.forEach((entity) => {
        tenantEntities.set(entity.id, {
          id: entity.id,
          tenant_id: tenant,
          status: entity.status ?? "active",
        });
      });
      this.entitiesByTenant.set(tenant, tenantEntities);
    });
  }

  async getByIdForTenant(
    tenant_id: string,
    legal_entity_id: string,
  ): Promise<LegalEntityRecord | null> {
    const tenantEntities = this.entitiesByTenant.get(tenant_id);
    if (!tenantEntities) {
      return null;
    }

    return tenantEntities.get(legal_entity_id) ?? null;
  }
}

export class CapturingDomainEventPublisher implements DomainEventPublisher {
  readonly events: Array<Record<string, unknown>> = [];

  async publishResourceCreated(options: {
    event_type: "payment_intent.created" | "quote.created" | "checkout_session.created";
    tenant_id: string;
    mode: "sandbox" | "live";
    resource_type: "payment_intent" | "quote" | "checkout_session";
    resource_id: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    this.events.push(options);
  }
}

export function createTestDependencies(
  domainEventPublisher: DomainEventPublisher = new NoopDomainEventPublisher(),
): ServiceContainerDependencies {
  let now = 1_760_000_000;

  return {
    payment_intent_repository: new InMemoryPaymentIntentRepository(),
    legal_entity_repository: new InMemoryLegalEntityRepository({
      tnt_test: [
        { id: "le_1", status: "active" },
        { id: "le_2", status: "active" },
        { id: "le_suspended", status: "suspended" },
      ],
    }),
    quote_repository: new InMemoryQuoteRepository(),
    checkout_session_repository: new InMemoryCheckoutSessionRepository(),
    domain_event_publisher: domainEventPublisher,
    now: () => {
      now += 1;
      return now;
    },
  };
}

function noopQueue(): Queue {
  return {
    send: async () => undefined,
    sendBatch: async () => undefined,
  } as unknown as Queue;
}

function noopR2(): R2Bucket {
  return {} as R2Bucket;
}

export function createTestEnv(): CoreEnv {
  return {
    DB: {} as D1Database,
    Q_LEDGER_COMMANDS: noopQueue(),
    Q_DOMAIN_EVENTS: noopQueue(),
    Q_NOTIFICATION_OUTBOX: noopQueue(),
    Q_WEBHOOK_OUTBOX: noopQueue(),
    ARTIFACTS_BUCKET: noopR2(),
    ENVIRONMENT: "local",
    APP_NAME: "pagooz-core",
    DEFAULT_LOCALE: "en",
    APP_VERSION: "0.1.0-test",
    GIT_SHA: "test-sha",
  };
}
