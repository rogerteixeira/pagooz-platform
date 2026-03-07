import type { Mode } from "./event-envelope";

export type LedgerReferenceType =
  | "quote"
  | "payment_intent"
  | "checkout_session"
  | "payment"
  | "payout"
  | "refund"
  | "manual";

export type LedgerAccountType =
  | "merchant_balance"
  | "pagooz_revenue"
  | "provider_cost"
  | "tax_payable"
  | "fx_pending"
  | "clearing_local";

export interface LedgerEntryCommand {
  account_type: LedgerAccountType;
  debit: number;
  credit: number;
  metadata: Record<string, unknown>;
}

export interface LedgerPostEntriesCommand {
  command_type: "ledger.post_entries";
  command_id: string;
  tenant_id: string;
  mode: Mode;
  legal_entity_id: string;
  journal_id: string;
  reference_type: LedgerReferenceType;
  reference_id: string;
  currency: string;
  entries: LedgerEntryCommand[];
}
