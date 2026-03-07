import type {
  LedgerEntryCommand,
  LedgerPostEntriesCommand,
} from "../../../../packages/shared/src/contracts/ledger-command";
import { generateId } from "../lib/ids";
import type {
  LedgerPostingStore,
  LedgerPostingStoreResult,
} from "../stores/d1-ledger-posting-store";

interface InMemoryAccount {
  id: string;
  tenant_id: string;
  mode: "sandbox" | "live";
  legal_entity_id: string;
  currency: string;
  account_type: string;
}

interface InMemoryJournal {
  id: string;
  tenant_id: string;
  mode: "sandbox" | "live";
  legal_entity_id: string;
  currency: string;
  reference_type: string;
  reference_id: string;
  posted_at: number;
}

interface InMemoryEntry {
  id: string;
  journal_id: string;
  account_id: string;
  account_type: string;
  debit: number;
  credit: number;
}

function accountKey(
  command: LedgerPostEntriesCommand,
  entry: LedgerEntryCommand,
): string {
  return [
    command.tenant_id,
    command.mode,
    command.legal_entity_id,
    command.currency,
    entry.account_type,
  ].join("|");
}

export class InMemoryLedgerPostingStore implements LedgerPostingStore {
  readonly journals = new Map<string, InMemoryJournal>();
  readonly entries: InMemoryEntry[] = [];
  readonly accounts = new Map<string, InMemoryAccount>();
  readonly balances = new Map<string, number>();

  async postJournal(
    command: LedgerPostEntriesCommand,
    postedAt: number,
  ): Promise<LedgerPostingStoreResult> {
    const totalDebit = command.entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = command.entries.reduce((sum, entry) => sum + entry.credit, 0);

    if (this.journals.has(command.journal_id)) {
      return {
        status: "duplicate",
        total_debit: totalDebit,
        total_credit: totalCredit,
        entry_count: command.entries.length,
      };
    }

    this.journals.set(command.journal_id, {
      id: command.journal_id,
      tenant_id: command.tenant_id,
      mode: command.mode,
      legal_entity_id: command.legal_entity_id,
      currency: command.currency,
      reference_type: command.reference_type,
      reference_id: command.reference_id,
      posted_at: postedAt,
    });

    for (const entry of command.entries) {
      const key = accountKey(command, entry);
      let account = this.accounts.get(key);
      if (!account) {
        account = {
          id: generateId("acct"),
          tenant_id: command.tenant_id,
          mode: command.mode,
          legal_entity_id: command.legal_entity_id,
          currency: command.currency,
          account_type: entry.account_type,
        };
        this.accounts.set(key, account);
      }

      this.entries.push({
        id: generateId("len"),
        journal_id: command.journal_id,
        account_id: account.id,
        account_type: entry.account_type,
        debit: entry.debit,
        credit: entry.credit,
      });

      const current = this.balances.get(account.id) ?? 0;
      this.balances.set(account.id, current + entry.debit - entry.credit);
    }

    return {
      status: "posted",
      total_debit: totalDebit,
      total_credit: totalCredit,
      entry_count: command.entries.length,
    };
  }
}
