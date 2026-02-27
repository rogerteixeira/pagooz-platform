# FX Providers Strategy v1

## Goal

- Free or low cost
- Reliable
- Cached
- Signed quotes

## Providers

1. AwesomeAPI (preferred for BRL pairs)
2. Frankfurter (fallback)

## Rules

- Cache rates 30-60 seconds
- Always store:
  - provider
  - rate
  - timestamp
  - expires_at
  - signature

- Never recalculate during checkout
- Always use stored quote