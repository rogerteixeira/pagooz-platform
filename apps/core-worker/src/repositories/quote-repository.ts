import type { Mode } from "../contracts/environment";
import type { Quote } from "../contracts/resources";
import type { CreateQuoteInput, QuoteRepository } from "./types";

export class D1QuoteRepository implements QuoteRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateQuoteInput): Promise<Quote> {
    await this.db
      .prepare(
        `INSERT INTO quotes (
          id, tenant_id, mode, payment_intent_id, payment_method, installments,
          payer_total, payer_currency, receiver_net, receiver_currency, fx_json,
          breakdown_json, rule_set_id, rule_set_version, expires_at, signature, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.id,
        input.tenant_id,
        input.mode,
        input.payment_intent_id,
        input.payment_method,
        input.installments,
        input.payer_total,
        input.payer_currency,
        input.receiver_net,
        input.receiver_currency,
        input.fx_json,
        input.breakdown_json,
        input.rule_set_id,
        input.rule_set_version,
        input.expires_at,
        input.signature,
        input.created_at,
      )
      .run();

    const created = await this.getById(input.tenant_id, input.mode, input.id);
    if (!created) {
      throw new Error("Failed to load created quote.");
    }

    return created;
  }

  async getById(tenant_id: string, mode: Mode, id: string): Promise<Quote | null> {
    const row = await this.db
      .prepare(
        `SELECT id, tenant_id, mode, payment_intent_id, payment_method, installments,
                payer_total, payer_currency, receiver_net, receiver_currency, fx_json,
                breakdown_json, rule_set_id, rule_set_version, expires_at, signature, created_at
           FROM quotes
          WHERE id = ? AND tenant_id = ? AND mode = ?`
      )
      .bind(id, tenant_id, mode)
      .first<Quote>();

    return row ?? null;
  }
}
