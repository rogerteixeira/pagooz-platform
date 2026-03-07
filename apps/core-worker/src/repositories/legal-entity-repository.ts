import type {
  LegalEntityRecord,
  LegalEntityRepository,
} from "./types";

export class D1LegalEntityRepository implements LegalEntityRepository {
  constructor(private readonly db: D1Database) {}

  async getByIdForTenant(
    tenant_id: string,
    legal_entity_id: string,
  ): Promise<LegalEntityRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, tenant_id, country, status
           FROM legal_entities
          WHERE id = ? AND tenant_id = ?
          LIMIT 1`
      )
      .bind(legal_entity_id, tenant_id)
      .first<LegalEntityRecord>();

    return row ?? null;
  }
}
