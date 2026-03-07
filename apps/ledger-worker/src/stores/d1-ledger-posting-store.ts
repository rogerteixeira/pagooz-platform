import type {
  LedgerEntryCommand,
  LedgerPostEntriesCommand,
} from "../../../../packages/shared/src/contracts/ledger-command";
import { generateId } from "../lib/ids";

export interface LedgerPostingStoreResult {
  status: "posted" | "duplicate";
  total_debit: number;
  total_credit: number;
  entry_count: number;
}

export interface LedgerPostingStore {
  postJournal(
    command: LedgerPostEntriesCommand,
    postedAt: number,
  ): Promise<LedgerPostingStoreResult>;
}

interface JournalRow {
  id: string;
}

interface AccountRow {
  id: string;
}

export class D1LedgerPostingStore implements LedgerPostingStore {
  constructor(private readonly db: D1Database) {}

  async postJournal(
    command: LedgerPostEntriesCommand,
    postedAt: number,
  ): Promise<LedgerPostingStoreResult> {
    const totalDebit = command.entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = command.entries.reduce((sum, entry) => sum + entry.credit, 0);

    const existing = await this.db
      .prepare(
        `SELECT id
           FROM ledger_journals
          WHERE id = ?
          LIMIT 1`,
      )
      .bind(command.journal_id)
      .first<JournalRow>();

    if (existing) {
      return {
        status: "duplicate",
        total_debit: totalDebit,
        total_credit: totalCredit,
        entry_count: command.entries.length,
      };
    }

    await this.db.exec("BEGIN TRANSACTION");
    try {
      const existingInTx = await this.db
        .prepare(
          `SELECT id
             FROM ledger_journals
            WHERE id = ?
            LIMIT 1`,
        )
        .bind(command.journal_id)
        .first<JournalRow>();

      if (existingInTx) {
        await this.db.exec("ROLLBACK");
        return {
          status: "duplicate",
          total_debit: totalDebit,
          total_credit: totalCredit,
          entry_count: command.entries.length,
        };
      }

      await this.db
        .prepare(
          `INSERT INTO ledger_journals (
            id, tenant_id, mode, legal_entity_id, currency,
            reference_type, reference_id, posted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          command.journal_id,
          command.tenant_id,
          command.mode,
          command.legal_entity_id,
          command.currency,
          command.reference_type,
          command.reference_id,
          postedAt,
        )
        .run();

      for (const entry of command.entries) {
        const accountId = await this.resolveOrCreateAccount(command, entry, postedAt);
        await this.appendEntry(command, entry, accountId, postedAt);
        await this.applyBalanceDelta(command, accountId, entry, postedAt);
      }

      await this.db.exec("COMMIT");
      return {
        status: "posted",
        total_debit: totalDebit,
        total_credit: totalCredit,
        entry_count: command.entries.length,
      };
    } catch (error) {
      await this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private async resolveOrCreateAccount(
    command: LedgerPostEntriesCommand,
    entry: LedgerEntryCommand,
    now: number,
  ): Promise<string> {
    const existing = await this.db
      .prepare(
        `SELECT id
           FROM balance_accounts
          WHERE tenant_id = ?
            AND mode = ?
            AND legal_entity_id = ?
            AND currency = ?
            AND account_type = ?
          LIMIT 1`,
      )
      .bind(
        command.tenant_id,
        command.mode,
        command.legal_entity_id,
        command.currency,
        entry.account_type,
      )
      .first<AccountRow>();

    if (existing) {
      return existing.id;
    }

    const accountId = generateId("acct");
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO balance_accounts (
          id, tenant_id, mode, legal_entity_id, currency, account_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        accountId,
        command.tenant_id,
        command.mode,
        command.legal_entity_id,
        command.currency,
        entry.account_type,
        now,
      )
      .run();

    const resolved = await this.db
      .prepare(
        `SELECT id
           FROM balance_accounts
          WHERE tenant_id = ?
            AND mode = ?
            AND legal_entity_id = ?
            AND currency = ?
            AND account_type = ?
          LIMIT 1`,
      )
      .bind(
        command.tenant_id,
        command.mode,
        command.legal_entity_id,
        command.currency,
        entry.account_type,
      )
      .first<AccountRow>();

    if (!resolved) {
      throw new Error("Failed to resolve balance account.");
    }

    return resolved.id;
  }

  private async appendEntry(
    command: LedgerPostEntriesCommand,
    entry: LedgerEntryCommand,
    accountId: string,
    now: number,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ledger_entries (
          id, tenant_id, mode, legal_entity_id, currency,
          journal_id, account_id, debit, credit,
          reference_type, reference_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        generateId("len"),
        command.tenant_id,
        command.mode,
        command.legal_entity_id,
        command.currency,
        command.journal_id,
        accountId,
        entry.debit,
        entry.credit,
        command.reference_type,
        command.reference_id,
        now,
      )
      .run();
  }

  private async applyBalanceDelta(
    command: LedgerPostEntriesCommand,
    accountId: string,
    entry: LedgerEntryCommand,
    now: number,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO account_balances (
          id, tenant_id, mode, account_id, balance, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        generateId("bal"),
        command.tenant_id,
        command.mode,
        accountId,
        now,
      )
      .run();

    const delta = entry.debit - entry.credit;
    await this.db
      .prepare(
        `UPDATE account_balances
            SET balance = balance + ?,
                updated_at = ?
          WHERE tenant_id = ?
            AND mode = ?
            AND account_id = ?`,
      )
      .bind(
        delta,
        now,
        command.tenant_id,
        command.mode,
        accountId,
      )
      .run();
  }
}
