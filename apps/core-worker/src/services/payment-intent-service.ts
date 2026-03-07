import type { Mode } from "../contracts/environment";
import type { PaymentIntent } from "../contracts/resources";
import { generateId } from "../lib/ids";
import type { DomainEventPublisher } from "./domain-event-publisher";
import type { CreatePaymentIntentPayload } from "./types";
import type { LegalEntityRepository, PaymentIntentRepository } from "../repositories/types";
import { invalidRequest, notFound } from "../http/errors";

export class CorePaymentIntentService {
  constructor(
    private readonly repository: PaymentIntentRepository,
    private readonly legalEntityRepository: LegalEntityRepository,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly now: () => number,
  ) {}

  async create(
    tenant_id: string,
    mode: Mode,
    payload: CreatePaymentIntentPayload,
  ): Promise<PaymentIntent> {
    const legalEntity = await this.legalEntityRepository.getByIdForTenant(
      tenant_id,
      payload.legal_entity_id,
    );

    if (!legalEntity) {
      throw notFound(
        "legal_entity_not_found",
        "Legal entity does not exist for the tenant.",
      );
    }

    if (legalEntity.status !== "active") {
      throw invalidRequest(
        "legal_entity_inactive",
        "Legal entity must be active to create a PaymentIntent.",
      );
    }

    const created = await this.repository.create({
      id: generateId("pi"),
      tenant_id,
      mode,
      legal_entity_id: payload.legal_entity_id,
      amount: payload.amount,
      currency: payload.currency,
      payer_country: payload.payer_country ?? null,
      settlement_term: payload.settlement_term ?? "D+2",
      status: "created",
      fee_strategy_json: payload.fee_strategy ? JSON.stringify(payload.fee_strategy) : null,
      metadata_json: payload.metadata ? JSON.stringify(payload.metadata) : null,
      created_at: this.now(),
    });

    await this.domainEventPublisher.publishResourceCreated({
      event_type: "payment_intent.created",
      tenant_id,
      mode,
      resource_type: "payment_intent",
      resource_id: created.id,
      data: {
        payment_intent_id: created.id,
        amount: created.amount,
        currency: created.currency,
      },
    });

    return created;
  }

  async getById(tenant_id: string, mode: Mode, id: string): Promise<PaymentIntent | null> {
    return this.repository.getById(tenant_id, mode, id);
  }

  async list(
    tenant_id: string,
    mode: Mode,
    options: { limit: number; status?: string },
  ): Promise<PaymentIntent[]> {
    return this.repository.list(tenant_id, mode, options);
  }
}
