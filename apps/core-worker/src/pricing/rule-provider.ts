import type {
  CorridorContext,
  EconomicRuleSet,
  FxMarkupRule,
  SettlementFeeRule,
} from "./types";

export interface PricingRuleContext {
  tenant_id: string;
  mode: "sandbox" | "live";
  payment_method: string;
  installments: number;
  settlement_term: string;
  corridor: CorridorContext;
}

export interface PricingRuleProvider {
  getRuleSet(context: PricingRuleContext): Promise<EconomicRuleSet>;
}

const BASE_RULE_SET: Omit<EconomicRuleSet, "quote_ttl_seconds" | "default_fx_markup"> = {
  id: "pricing_rules_v1",
  version: 1,
  service_fee: {
    percent_bps: 180,
    fixed: 30,
    minimum: 50,
    maximum: 5000,
  },
  mdr_by_payment_method: {
    card: {
      percent_bps: 260,
      fixed: 0,
      minimum: 0,
      maximum: 10000,
      installment_bps: 35,
    },
    pix: {
      percent_bps: 99,
      fixed: 0,
      minimum: 0,
      maximum: 8000,
      installment_bps: 0,
    },
    boleto: {
      percent_bps: 140,
      fixed: 150,
      minimum: 150,
      maximum: 9000,
      installment_bps: 0,
    },
  },
  default_mdr: {
    percent_bps: 220,
    fixed: 0,
    minimum: 0,
    maximum: 9000,
    installment_bps: 20,
  },
  settlement_rules: {
    "D+0": {
      term: "D+0",
      percent_bps: 120,
      fixed: 0,
      minimum: 0,
      maximum: 7000,
    },
    "D+1": {
      term: "D+1",
      percent_bps: 70,
      fixed: 0,
      minimum: 0,
      maximum: 5000,
    },
    "D+2": {
      term: "D+2",
      percent_bps: 0,
      fixed: 0,
      minimum: 0,
      maximum: 0,
    },
  },
  default_settlement_rule: {
    term: "D+2",
    percent_bps: 0,
    fixed: 0,
    minimum: 0,
    maximum: 0,
  },
  fx_markup_by_corridor: {
    "BR->US:BRL/USD": {
      markup_bps: 95,
    },
    "MX->US:MXN/USD": {
      markup_bps: 110,
    },
  },
  tax_rules: [
    {
      code: "platform_tax",
      label: "Platform tax",
      percent_bps: 500,
      applies_to: ["service_fee", "mdr", "settlement_fee", "fx_markup"],
      condition: "always",
    },
    {
      code: "cross_border_surcharge",
      label: "Cross-border surcharge",
      percent_bps: 35,
      applies_to: ["fx_markup"],
      condition: "cross_border",
    },
  ],
};

function normalizeSettlementTerm(term: string): string {
  return term.trim().toUpperCase();
}

function dynamicSettlementRule(term: string): SettlementFeeRule | null {
  const match = /^D\+([0-9]{1,2})$/i.exec(term.trim());
  if (!match) {
    return null;
  }

  const days = Number(match[1]);
  if (Number.isNaN(days)) {
    return null;
  }

  if (days <= 0) {
    return {
      term: "D+0",
      percent_bps: 120,
      fixed: 0,
      minimum: 0,
      maximum: 7000,
    };
  }

  if (days === 1) {
    return {
      term: "D+1",
      percent_bps: 70,
      fixed: 0,
      minimum: 0,
      maximum: 5000,
    };
  }

  if (days === 2) {
    return {
      term: "D+2",
      percent_bps: 0,
      fixed: 0,
      minimum: 0,
      maximum: 0,
    };
  }

  return {
    term: `D+${days}`,
    percent_bps: 0,
    fixed: 0,
    minimum: 0,
    maximum: 0,
  };
}

function defaultFxMarkup(corridor: CorridorContext): FxMarkupRule {
  const crossBorder = corridor.payer_country !== corridor.receiver_country;
  return {
    markup_bps: crossBorder ? 125 : 0,
  };
}

export class InCodePricingRuleProvider implements PricingRuleProvider {
  async getRuleSet(context: PricingRuleContext): Promise<EconomicRuleSet> {
    const normalizedTerm = normalizeSettlementTerm(context.settlement_term);
    const dynamicRule = dynamicSettlementRule(normalizedTerm);
    const settlementRules = {
      ...BASE_RULE_SET.settlement_rules,
      ...(dynamicRule ? { [dynamicRule.term]: dynamicRule } : {}),
    };

    return {
      ...BASE_RULE_SET,
      quote_ttl_seconds: context.mode === "sandbox" ? 10 * 60 : 5 * 60,
      default_fx_markup: defaultFxMarkup(context.corridor),
      settlement_rules: settlementRules,
    };
  }
}
