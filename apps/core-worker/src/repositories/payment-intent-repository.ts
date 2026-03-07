import type { Mode } from "../contracts/environment";
import type { PaymentIntent } from "../contracts/resources";
import type {
  CreatePaymentIntentInput,
  PaymentIntentListOptions,
  PaymentIntentRepository,
} from "./types";

export class D1PaymentIntentRepository implements PaymentIntentRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    await this.db
      .prepare(
        `INSERT INTO payment_intents (
          id, tenant_id, mode, legal_entity_id, amount, currency, payer_country,
          settlement_term, status, fee_strategy_json, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.id,
        input.tenant_id,
        input.mode,
        input.legal_entity_id,
        input.amount,
        input.currency,
        input.payer_country,
        input.settlement_term,
        input.status,
        input.fee_strategy_json,
        input.metadata_json,
        input.created_at,
        null,
      )
      .run();

    const created = await this.getById(input.tenant_id, input.mode, input.id);
    if (!created) {
      throw new Error("Failed to load created payment_intent.");
    }

    return created;
  }

  async getById(tenant_id: string, mode: Mode, id: string): Promise<PaymentIntent | null> {
    const row = await this.db
      .prepare(
        `SELECT id, tenant_id, mode, legal_entity_id, amount, currency, payer_country,
                settlement_term, status, fee_strategy_json, metadata_json, created_at, updated_at
           FROM payment_intents
          WHERE id = ? AND tenant_id = ? AND mode = ?`
      )
      .bind(id, tenant_id, mode)
      .first<PaymentIntent>();

    return row ?? null;
  }

  async list(
    tenant_id: string,
    mode: Mode,
    options: PaymentIntentListOptions,
  ): Promise<PaymentIntent[]> {
    if (options.status) {
      const result = await this.db
        .prepare(
          `SELECT id, tenant_id, mode, legal_entity_id, amount, currency, payer_country,
                  settlement_term, status, fee_strategy_json, metadata_json, created_at, updated_at
             FROM payment_intents
            WHERE tenant_id = ? AND mode = ? AND status = ?
            ORDER BY created_at DESC
            LIMIT ?`
        )
        .bind(tenant_id, mode, options.status, options.limit)
        .all<PaymentIntent>();

      return result.results ?? [];
    }

    const result = await this.db
      .prepare(
        `SELECT id, tenant_id, mode, legal_entity_id, amount, currency, payer_country,
                settlement_term, status, fee_strategy_json, metadata_json, created_at, updated_at
           FROM payment_intents
          WHERE tenant_id = ? AND mode = ?
          ORDER BY created_at DESC
          LIMIT ?`
      )
      .bind(tenant_id, mode, options.limit)
      .all<PaymentIntent>();

    return result.results ?? [];
  }
}
