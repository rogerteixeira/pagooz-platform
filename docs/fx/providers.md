# Economic Engine and FX Provider Path

## Current State (v1)
The quote flow uses Economic Engine v1 with deterministic rule-driven calculations.

Inputs include:
- tenant and mode
- payment intent context
- payment method
- installments
- settlement term
- corridor context
- fee strategy

Outputs include:
- `payer_total`
- `receiver_net`
- fee breakdown (`service_fee`, `mdr`, `settlement_fee`, `fx_markup`)
- tax breakdown (`generic_tax` and other configured items)
- applied rule summary and fallback markers
- deterministic quote signature

## Corridor Context Resolution
Corridor context is resolved through `CorridorContextResolver`.

Data sources:
1. explicit request/payment context
2. legal entity profile (`legal_entity.country`)
3. tenant defaults/fallbacks

`fee_strategy` is not used as a corridor geography source.

## FX Fields (Reference-only)
The current FX object includes:
- `reference_rate_ppm`
- `effective_rate_ppm`

These are structural placeholders to preserve contract shape and deterministic calculations.
They are reference-only values, not live provider rates and not treasury execution quotes.

## Fee Strategy Behavior
Supported absorption modes:
- `payer`
- `merchant`

Absorption mode changes how total economics are distributed between `payer_total` and `receiver_net`.

## Forward Path
The provider interface is designed to evolve into:
- live provider-backed rate acquisition
- corridor and route-aware markup policies
- treasury execution alignment
- auditable replay using signed quote artifacts
