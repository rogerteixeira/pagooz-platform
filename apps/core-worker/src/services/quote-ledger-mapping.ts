import type { Mode } from "../contracts/environment";
import { generateId } from "../lib/ids";
import type { EconomicEngineResult } from "../pricing/types";
import type { LedgerPostEntriesCommand } from "../../../../packages/shared/src/contracts/ledger-command";

export interface QuoteLedgerMappingInput {
  tenant_id: string;
  mode: Mode;
  legal_entity_id: string;
  quote_id: string;
  payment_intent_id: string;
  currency: string;
  economics: EconomicEngineResult;
}

function quoteJournalId(quoteId: string): string {
  return `jrnl_qt_${quoteId}`;
}

// Quote journal policy:
// - It records a provisional economics snapshot at quote time.
// - Clearing account represents expected payer-side incoming amount.
// - Merchant balance represents expected merchant-side payable amount.
// - Pagooz revenue and tax payable represent provisional fee/tax allocations.
export function buildQuoteLedgerCommand(
  input: QuoteLedgerMappingInput,
): LedgerPostEntriesCommand {
  const totalFees = input.economics.fee_breakdown.total_fees;
  const totalTax = input.economics.tax_breakdown.total_tax;

  return {
    command_type: "ledger.post_entries",
    command_id: generateId("cmd"),
    tenant_id: input.tenant_id,
    mode: input.mode,
    legal_entity_id: input.legal_entity_id,
    journal_id: quoteJournalId(input.quote_id),
    reference_type: "quote",
    reference_id: input.quote_id,
    currency: input.currency,
    entries: [
      {
        account_type: "clearing_local",
        debit: input.economics.payer_total,
        credit: 0,
        metadata: {
          reason: "quote_gross_expected_inflow",
          payment_intent_id: input.payment_intent_id,
        },
      },
      {
        account_type: "merchant_balance",
        debit: 0,
        credit: input.economics.receiver_net,
        metadata: {
          reason: "quote_expected_merchant_payable",
          payment_intent_id: input.payment_intent_id,
        },
      },
      {
        account_type: "pagooz_revenue",
        debit: 0,
        credit: totalFees,
        metadata: {
          reason: "quote_provisional_fee_allocation",
          payment_intent_id: input.payment_intent_id,
        },
      },
      {
        account_type: "tax_payable",
        debit: 0,
        credit: totalTax,
        metadata: {
          reason: "quote_provisional_tax_allocation",
          payment_intent_id: input.payment_intent_id,
        },
      },
    ],
  };
}
