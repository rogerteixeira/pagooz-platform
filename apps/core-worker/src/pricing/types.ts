import type { Mode } from "../contracts/environment";
import type { JsonObject, PaymentIntent } from "../contracts/resources";

export type FeeAbsorption = "payer" | "merchant";
export type FeeComponentKey = "service_fee" | "mdr" | "settlement_fee" | "fx_markup";

export interface CorridorContext {
  payer_country: string;
  receiver_country: string;
  payer_currency: string;
  receiver_currency: string;
  corridor_code: string;
}

export interface FeeStrategyContext {
  absorption: FeeAbsorption;
  raw: JsonObject | null;
}

export interface EconomicEngineInput {
  tenant_id: string;
  mode: Mode;
  payment_intent: PaymentIntent;
  payment_method: string;
  installments: number;
  settlement_term: string;
  corridor: CorridorContext;
  fee_strategy: FeeStrategyContext;
}

export interface FeeRule {
  percent_bps: number;
  fixed: number;
  minimum: number;
  maximum: number;
}

export interface MdrRule extends FeeRule {
  installment_bps: number;
}

export interface SettlementFeeRule extends FeeRule {
  term: string;
}

export interface FxMarkupRule {
  markup_bps: number;
}

export interface TaxRule {
  code: string;
  label: string;
  percent_bps: number;
  applies_to: FeeComponentKey[];
  condition: "always" | "cross_border";
}

export interface EconomicRuleSet {
  id: string;
  version: number;
  quote_ttl_seconds: number;
  service_fee: FeeRule;
  mdr_by_payment_method: Record<string, MdrRule>;
  default_mdr: MdrRule;
  settlement_rules: Record<string, SettlementFeeRule>;
  default_settlement_rule: SettlementFeeRule;
  fx_markup_by_corridor: Record<string, FxMarkupRule>;
  default_fx_markup: FxMarkupRule;
  tax_rules: TaxRule[];
}

export interface FeeComponentResult {
  amount: number;
  percent_bps: number;
  fixed: number;
  minimum: number;
  maximum: number;
  applied_minimum: boolean;
  applied_maximum: boolean;
}

export interface FeeBreakdown {
  base_amount: number;
  service_fee: FeeComponentResult;
  mdr: FeeComponentResult & {
    installments: number;
    installment_bps: number;
    effective_percent_bps: number;
  };
  settlement_fee: FeeComponentResult & {
    term: string;
  };
  fx_markup: {
    amount: number;
    markup_bps: number;
    corridor_code: string;
  };
  total_fees: number;
}

export interface TaxComponentResult {
  code: string;
  label: string;
  amount: number;
  percent_bps: number;
  taxable_components: FeeComponentKey[];
  taxable_base: number;
}

export interface TaxBreakdown {
  items: TaxComponentResult[];
  total_tax: number;
}

export interface AppliedRuleSummary {
  rule_set_id: string;
  rule_set_version: number;
  payment_method_rule: string;
  settlement_rule: string;
  fx_markup_rule: string;
  fee_strategy: FeeAbsorption;
  fallbacks: string[];
}

export interface EconomicEngineResult {
  payer_total: number;
  receiver_net: number;
  payer_currency: string;
  receiver_currency: string;
  fee_breakdown: FeeBreakdown;
  tax_breakdown: TaxBreakdown;
  applied_rule_summary: AppliedRuleSummary;
  expires_at: number;
  signature_input_base: string;
  signature: string;
  fx: {
    corridor_code: string;
    payer_currency: string;
    receiver_currency: string;
    markup_bps: number;
    base_rate_ppm: number;
    effective_rate_ppm: number;
  };
}
