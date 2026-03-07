import type { Mode } from "../contracts/environment";
import type { CheckoutSession } from "../contracts/resources";
import type {
  CheckoutSessionListOptions,
  CheckoutSessionRepository,
  CreateCheckoutSessionInput,
} from "./types";

export class D1CheckoutSessionRepository implements CheckoutSessionRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    await this.db
      .prepare(
        `INSERT INTO checkout_sessions (
          id, tenant_id, mode, payment_intent_id, quote_id,
          locale, status, url, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.id,
        input.tenant_id,
        input.mode,
        input.payment_intent_id,
        input.quote_id,
        input.locale,
        input.status,
        input.url,
        input.expires_at,
        input.created_at,
      )
      .run();

    const created = await this.getById(input.tenant_id, input.mode, input.id);
    if (!created) {
      throw new Error("Failed to load created checkout_session.");
    }

    return created;
  }

  async getById(
    tenant_id: string,
    mode: Mode,
    id: string,
  ): Promise<CheckoutSession | null> {
    const row = await this.db
      .prepare(
        `SELECT id, tenant_id, mode, payment_intent_id, quote_id,
                locale, status, url, expires_at, created_at
           FROM checkout_sessions
          WHERE id = ? AND tenant_id = ? AND mode = ?`
      )
      .bind(id, tenant_id, mode)
      .first<CheckoutSession>();

    return row ?? null;
  }

  async list(
    tenant_id: string,
    mode: Mode,
    options: CheckoutSessionListOptions,
  ): Promise<CheckoutSession[]> {
    if (options.status) {
      const result = await this.db
        .prepare(
          `SELECT id, tenant_id, mode, payment_intent_id, quote_id,
                  locale, status, url, expires_at, created_at
             FROM checkout_sessions
            WHERE tenant_id = ? AND mode = ? AND status = ?
            ORDER BY created_at DESC
            LIMIT ?`
        )
        .bind(tenant_id, mode, options.status, options.limit)
        .all<CheckoutSession>();

      return result.results ?? [];
    }

    const result = await this.db
      .prepare(
        `SELECT id, tenant_id, mode, payment_intent_id, quote_id,
                locale, status, url, expires_at, created_at
           FROM checkout_sessions
          WHERE tenant_id = ? AND mode = ?
          ORDER BY created_at DESC
          LIMIT ?`
      )
      .bind(tenant_id, mode, options.limit)
      .all<CheckoutSession>();

    return result.results ?? [];
  }
}
