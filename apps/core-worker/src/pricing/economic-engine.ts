import { sha256Hex } from "../lib/hash";
import type { PricingRuleProvider } from "./rule-provider";
import type {
  EconomicEngineInput,
  EconomicEngineResult,
  FeeComponentKey,
  FeeComponentResult,
  FeeRule,
} from "./types";

function percentAmount(baseAmount: number, bps: number): number {
  return Math.round((baseAmount * bps) / 10_000);
}

function computeFeeComponent(
  baseAmount: number,
  rule: FeeRule,
  effectivePercentBps: number = rule.percent_bps,
): FeeComponentResult {
  const rawAmount = percentAmount(baseAmount, effectivePercentBps) + rule.fixed;
  const boundedLow = Math.max(rawAmount, rule.minimum);
  const bounded = Math.min(boundedLow, rule.maximum);

  return {
    amount: bounded,
    percent_bps: effectivePercentBps,
    fixed: rule.fixed,
    minimum: rule.minimum,
    maximum: rule.maximum,
    applied_minimum: bounded === rule.minimum && bounded !== rawAmount,
    applied_maximum: bounded === rule.maximum && bounded !== rawAmount,
  };
}

function resolveSettlementTerm(
  term: string,
  fallbackTerm: string,
): { term: string; used_fallback: boolean } {
  const normalized = term.trim().toUpperCase();
  if (/^D\+[0-9]{1,2}$/.test(normalized)) {
    return {
      term: normalized,
      used_fallback: false,
    };
  }

  return {
    term: fallbackTerm,
    used_fallback: true,
  };
}

export class EconomicEngineV1 {
  constructor(
    private readonly ruleProvider: PricingRuleProvider,
    private readonly now: () => number,
  ) {}

  async quote(input: EconomicEngineInput): Promise<EconomicEngineResult> {
    const rules = await this.ruleProvider.getRuleSet({
      tenant_id: input.tenant_id,
      mode: input.mode,
      payment_method: input.payment_method,
      installments: input.installments,
      settlement_term: input.settlement_term,
      corridor: input.corridor,
    });

    const baseAmount = input.payment_intent.amount;
    const paymentMethodKey = input.payment_method.trim().toLowerCase();
    const fallbacks: string[] = [];

    const mdrRule = rules.mdr_by_payment_method[paymentMethodKey] ?? rules.default_mdr;
    const paymentMethodRuleName =
      rules.mdr_by_payment_method[paymentMethodKey] ? paymentMethodKey : "default";

    if (paymentMethodRuleName === "default") {
      fallbacks.push("mdr_rule_default");
    }

    const settlementResolution = resolveSettlementTerm(
      input.settlement_term,
      rules.default_settlement_rule.term,
    );
    const requestedSettlementTerm = settlementResolution.term;
    const settlementRule = rules.settlement_rules[requestedSettlementTerm] ??
      rules.default_settlement_rule;

    if (settlementResolution.used_fallback || settlementRule.term !== requestedSettlementTerm) {
      fallbacks.push("settlement_rule_default");
    }

    const fxRule = rules.fx_markup_by_corridor[input.corridor.corridor_code] ??
      rules.default_fx_markup;
    const fxRuleName = rules.fx_markup_by_corridor[input.corridor.corridor_code]
      ? input.corridor.corridor_code
      : "default";

    if (fxRuleName === "default") {
      fallbacks.push("fx_markup_default");
    }

    const serviceFee = computeFeeComponent(baseAmount, rules.service_fee);
    const installmentBps = Math.max(0, input.installments - 1) * mdrRule.installment_bps;
    const effectiveMdrBps = mdrRule.percent_bps + installmentBps;
    const mdrFee = computeFeeComponent(baseAmount, mdrRule, effectiveMdrBps);
    const settlementFee = computeFeeComponent(baseAmount, settlementRule);
    const fxMarkupAmount = percentAmount(baseAmount, fxRule.markup_bps);

    const feeAmounts: Record<FeeComponentKey, number> = {
      service_fee: serviceFee.amount,
      mdr: mdrFee.amount,
      settlement_fee: settlementFee.amount,
      fx_markup: fxMarkupAmount,
    };

    const totalFees =
      serviceFee.amount + mdrFee.amount + settlementFee.amount + fxMarkupAmount;

    const crossBorder = input.corridor.payer_country !== input.corridor.receiver_country;
    const taxItems = rules.tax_rules
      .filter((rule) => (rule.condition === "cross_border" ? crossBorder : true))
      .map((rule) => {
        const taxableBase = rule.applies_to.reduce((sum, key) => sum + feeAmounts[key], 0);
        const amount = percentAmount(taxableBase, rule.percent_bps);
        return {
          code: rule.code,
          label: rule.label,
          amount,
          percent_bps: rule.percent_bps,
          taxable_components: rule.applies_to,
          taxable_base: taxableBase,
        };
      });

    const totalTax = taxItems.reduce((sum, item) => sum + item.amount, 0);
    const impactTotal = totalFees + totalTax;

    const payerTotal = input.fee_strategy.absorption === "payer"
      ? baseAmount + impactTotal
      : baseAmount;

    const receiverNet = input.fee_strategy.absorption === "payer"
      ? baseAmount
      : Math.max(0, baseAmount - impactTotal);

    const expiresAt = this.now() + rules.quote_ttl_seconds;
    const signatureInputBase = [
      `tenant=${input.tenant_id}`,
      `mode=${input.mode}`,
      `payment_intent_id=${input.payment_intent.id}`,
      `payment_method=${paymentMethodKey}`,
      `installments=${input.installments}`,
      `settlement_term=${settlementRule.term}`,
      `fee_strategy=${input.fee_strategy.absorption}`,
      `payer_total=${payerTotal}`,
      `receiver_net=${receiverNet}`,
      `service_fee=${serviceFee.amount}`,
      `mdr=${mdrFee.amount}`,
      `settlement_fee=${settlementFee.amount}`,
      `fx_markup=${fxMarkupAmount}`,
      `tax_total=${totalTax}`,
      `rule_set=${rules.id}@${rules.version}`,
      `expires_at=${expiresAt}`,
    ].join("|");

    const signature = await sha256Hex(signatureInputBase);

    return {
      payer_total: payerTotal,
      receiver_net: receiverNet,
      payer_currency: input.corridor.payer_currency,
      receiver_currency: input.corridor.receiver_currency,
      fee_breakdown: {
        base_amount: baseAmount,
        service_fee: serviceFee,
        mdr: {
          ...mdrFee,
          installments: input.installments,
          installment_bps: mdrRule.installment_bps,
          effective_percent_bps: effectiveMdrBps,
        },
        settlement_fee: {
          ...settlementFee,
          term: settlementRule.term,
        },
        fx_markup: {
          amount: fxMarkupAmount,
          markup_bps: fxRule.markup_bps,
          corridor_code: input.corridor.corridor_code,
        },
        total_fees: totalFees,
      },
      tax_breakdown: {
        items: taxItems,
        total_tax: totalTax,
      },
      applied_rule_summary: {
        rule_set_id: rules.id,
        rule_set_version: rules.version,
        payment_method_rule: paymentMethodRuleName,
        settlement_rule: settlementRule.term,
        fx_markup_rule: fxRuleName,
        fee_strategy: input.fee_strategy.absorption,
        fallbacks,
      },
      expires_at: expiresAt,
      signature_input_base: signatureInputBase,
      signature,
      fx: {
        corridor_code: input.corridor.corridor_code,
        payer_currency: input.corridor.payer_currency,
        receiver_currency: input.corridor.receiver_currency,
        markup_bps: fxRule.markup_bps,
        base_rate_ppm: 1_000_000,
        effective_rate_ppm: 1_000_000 + fxRule.markup_bps * 100,
      },
    };
  }
}
