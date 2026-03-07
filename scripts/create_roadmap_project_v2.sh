#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_NAME="${1:-pagooz-platform}"
PLANNING_WINDOW="${2:-$(date +%Y-%m)}"
OUTPUT_DIR="${3:-docs/roadmaps}"

slug="$(
  printf '%s' "$PROJECT_NAME" \
    | tr '[:upper:]' '[:lower:]' \
    | tr ' /_' '-' \
    | tr -cd 'a-z0-9-'
)"
slug="$(printf '%s' "$slug" | sed -E 's/-+/-/g; s/^-+//; s/-+$//')"
if [[ -z "$slug" ]]; then
  slug="roadmap"
fi

mkdir -p "$OUTPUT_DIR"

timestamp="$(date +%Y%m%d)"
output_file="${OUTPUT_DIR}/${timestamp}-${slug}-roadmap-v2.md"

if [[ -e "$output_file" ]]; then
  echo "Roadmap file already exists: $output_file"
  exit 1
fi

cat >"$output_file" <<EOF
# ${PROJECT_NAME} Roadmap (${PLANNING_WINDOW})

## Scope
- Product: ${PROJECT_NAME}
- Planning window: ${PLANNING_WINDOW}
- Architecture baseline: Core Worker, Ledger Worker, Notification Worker
- Environment model: local, dev, staging, prod
- Mode model: sandbox, live

## Priorities
1. Core API reliability and contract stability
2. Economic engine correctness and explainability
3. Ledger posting correctness and idempotency
4. Notification and webhook delivery hardening
5. Observability, auditability, and operational readiness

## Workstreams
### Core API
- Stabilize request/response contracts
- Tighten validation and idempotency behavior
- Keep tenant + mode isolation explicit in every path

### Pricing and Quotes
- Expand rule provider coverage by corridor and method
- Improve fallback transparency and audit output
- Define controlled rollout strategy for live pricing inputs

### Ledger Foundation
- Expand journal mapping coverage for new lifecycle events
- Add reconciliation and drift diagnostics
- Harden duplicate-delivery and replay protection

### Platform Operations
- Keep wrangler configuration aligned by environment
- Verify migrations and queue contracts before each deployment
- Maintain deterministic deploy flow for core/ledger/notification

## Risks and Mitigations
- Rule drift across environments: gate changes through staging verification
- Scope model regression: enforce route-level tests for required_scopes
- Ledger posting regressions: keep balanced-journal + idempotency tests mandatory

## Exit Criteria
- Verify script passes
- Type check passes
- Target test suites pass
- Migrations apply cleanly per environment

EOF

echo "Created roadmap template: $output_file"
