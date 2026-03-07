import type { LedgerPostEntriesCommand } from "../../../../packages/shared/src/contracts/ledger-command";
import type {
  LedgerEventPublisher,
} from "./ledger-event-publisher";
import type {
  LedgerPostingStore,
  LedgerPostingStoreResult,
} from "../stores/d1-ledger-posting-store";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMode(value: unknown): value is "sandbox" | "live" {
  return value === "sandbox" || value === "live";
}

function isIntegerAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type LedgerEntry = LedgerPostEntriesCommand["entries"][number];
type LedgerAccountType = LedgerEntry["account_type"];
type LedgerReferenceType = LedgerPostEntriesCommand["reference_type"];

const ALLOWED_ACCOUNT_TYPES: readonly LedgerAccountType[] = [
  "merchant_balance",
  "pagooz_revenue",
  "provider_cost",
  "tax_payable",
  "fx_pending",
  "clearing_local",
];

const ALLOWED_REFERENCE_TYPES: readonly LedgerReferenceType[] = [
  "quote",
  "payment_intent",
  "checkout_session",
  "payment",
  "payout",
  "refund",
  "manual",
];

function isLedgerAccountType(value: unknown): value is LedgerAccountType {
  return typeof value === "string" &&
    (ALLOWED_ACCOUNT_TYPES as readonly string[]).includes(value);
}

function isLedgerReferenceType(value: unknown): value is LedgerReferenceType {
  return typeof value === "string" &&
    (ALLOWED_REFERENCE_TYPES as readonly string[]).includes(value);
}

export class LedgerCommandValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parseLedgerPostEntriesCommand(input: unknown): LedgerPostEntriesCommand {
  if (!isRecord(input)) {
    throw new LedgerCommandValidationError(
      "invalid_command",
      "Ledger command payload must be an object.",
    );
  }

  if (input.command_type !== "ledger.post_entries") {
    throw new LedgerCommandValidationError(
      "unsupported_command_type",
      "Command type must be 'ledger.post_entries'.",
    );
  }

  if (!isNonEmptyString(input.command_id)) {
    throw new LedgerCommandValidationError(
      "missing_command_id",
      "command_id is required.",
    );
  }

  if (!isNonEmptyString(input.tenant_id)) {
    throw new LedgerCommandValidationError(
      "missing_tenant_id",
      "tenant_id is required.",
    );
  }

  if (!isMode(input.mode)) {
    throw new LedgerCommandValidationError(
      "invalid_mode",
      "mode must be 'sandbox' or 'live'.",
    );
  }

  if (!isNonEmptyString(input.legal_entity_id)) {
    throw new LedgerCommandValidationError(
      "missing_legal_entity_id",
      "legal_entity_id is required.",
    );
  }

  if (!isNonEmptyString(input.journal_id)) {
    throw new LedgerCommandValidationError(
      "missing_journal_id",
      "journal_id is required.",
    );
  }

  if (!isLedgerReferenceType(input.reference_type) || !isNonEmptyString(input.reference_id)) {
    throw new LedgerCommandValidationError(
      "invalid_reference",
      "reference_type and reference_id are required.",
    );
  }

  if (!isNonEmptyString(input.currency)) {
    throw new LedgerCommandValidationError(
      "invalid_currency",
      "currency is required.",
    );
  }

  if (!Array.isArray(input.entries) || input.entries.length < 2) {
    throw new LedgerCommandValidationError(
      "invalid_entries",
      "entries must contain at least two posting lines.",
    );
  }

  const parsedEntries: LedgerEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of input.entries) {
    if (!isRecord(entry)) {
      throw new LedgerCommandValidationError(
        "invalid_entry_shape",
        "each entry must be an object.",
      );
    }

    if (!isLedgerAccountType(entry.account_type)) {
      throw new LedgerCommandValidationError(
        "unsupported_account_type",
        `Unsupported account_type: ${entry.account_type}`,
      );
    }

    if (!isIntegerAmount(entry.debit) || !isIntegerAmount(entry.credit)) {
      throw new LedgerCommandValidationError(
        "invalid_amount",
        "entry.debit and entry.credit must be non-negative integers.",
      );
    }

    if (entry.debit > 0 && entry.credit > 0) {
      throw new LedgerCommandValidationError(
        "invalid_entry_side",
        "entry cannot contain both debit and credit amounts.",
      );
    }

    if (entry.debit === 0 && entry.credit === 0) {
      throw new LedgerCommandValidationError(
        "zero_amount_entry",
        "entry must contain either debit or credit amount.",
      );
    }

    if (!isRecord(entry.metadata)) {
      throw new LedgerCommandValidationError(
        "invalid_entry_metadata",
        "entry.metadata must be an object.",
      );
    }

    parsedEntries.push({
      account_type: entry.account_type,
      debit: entry.debit,
      credit: entry.credit,
      metadata: { ...entry.metadata },
    });
    totalDebit += entry.debit;
    totalCredit += entry.credit;
  }

  if (totalDebit !== totalCredit) {
    throw new LedgerCommandValidationError(
      "unbalanced_journal",
      "Total debit must equal total credit.",
    );
  }

  if (totalDebit <= 0) {
    throw new LedgerCommandValidationError(
      "empty_journal",
      "Journal totals must be greater than zero.",
    );
  }

  return {
    command_type: "ledger.post_entries",
    command_id: input.command_id,
    tenant_id: input.tenant_id,
    mode: input.mode,
    legal_entity_id: input.legal_entity_id,
    journal_id: input.journal_id,
    reference_type: input.reference_type,
    reference_id: input.reference_id,
    currency: input.currency,
    entries: parsedEntries,
  };
}

export class LedgerPostingService {
  constructor(
    private readonly store: LedgerPostingStore,
    private readonly eventPublisher: LedgerEventPublisher,
    private readonly now: () => number,
  ) {}

  async process(input: unknown): Promise<LedgerPostingStoreResult> {
    const command = parseLedgerPostEntriesCommand(input);
    const postedAt = this.now();
    const result = await this.store.postJournal(command, postedAt);

    if (result.status === "posted") {
      await this.eventPublisher.publishJournalPosted({
        tenant_id: command.tenant_id,
        mode: command.mode,
        journal_id: command.journal_id,
        reference_type: command.reference_type,
        reference_id: command.reference_id,
        currency: command.currency,
        entry_count: result.entry_count,
        total_debit: result.total_debit,
        total_credit: result.total_credit,
        posted_at: postedAt,
      });
    }

    return result;
  }
}
