#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Pagooz GitHub Roadmap + Project v2 bootstrap
#
# Usage:
#   bash scripts/create_roadmap_project_v2.sh OWNER/REPO OWNER_TYPE OWNER_LOGIN PROJECT_TITLE
#
# Example:
#   bash scripts/create_roadmap_project_v2.sh rogerteixeira/pagooz-platform user rogerteixeira "Pagooz Roadmap"
#
# OWNER_TYPE:
#   user | org
# ============================================================

REPO="${1:-}"
OWNER_TYPE="${2:-}"
OWNER_LOGIN="${3:-}"
PROJECT_TITLE="${4:-Pagooz Roadmap}"

if [[ -z "$REPO" || -z "$OWNER_TYPE" || -z "$OWNER_LOGIN" ]]; then
  echo "Usage: $0 OWNER/REPO OWNER_TYPE OWNER_LOGIN PROJECT_TITLE"
  echo "Example: $0 rogerteixeira/pagooz-platform user rogerteixeira \"Pagooz Roadmap\""
  exit 1
fi

echo "==> Repo: $REPO"
echo "==> Owner type: $OWNER_TYPE"
echo "==> Owner login: $OWNER_LOGIN"
echo "==> Project title: $PROJECT_TITLE"

gh repo view "$REPO" >/dev/null

echo "==> Checking GitHub auth..."
gh auth status || true
echo

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

label_exists() {
  local name="$1"
  gh label list -R "$REPO" --limit 500 --json name --jq '.[].name' | grep -Fxq "$name"
}

create_label() {
  local name="$1"
  local color="$2"
  local desc="$3"

  gh label create "$name" -R "$REPO" --color "$color" --description "$desc" --force >/dev/null
  echo "Upserted label: $name"
}

milestone_exists() {
  local title="$1"
  gh api "repos/$REPO/milestones?state=all&per_page=100" \
    --jq ".[] | select(.title==\"$title\") | .number" | grep -q .
}

create_milestone() {
  local title="$1"
  local desc="$2"

  if milestone_exists "$title"; then
    echo "Milestone exists: $title"
  else
    gh api -X POST "repos/$REPO/milestones" \
      -f title="$title" \
      -f description="$desc" >/dev/null
    echo "Created milestone: $title"
  fi
}

issue_exists_exact() {
  local title="$1"
  gh issue list -R "$REPO" --limit 2000 --search "\"$title\" in:title" --json title --jq '.[].title' | grep -Fxq "$title"
}

create_issue() {
  local title="$1"
  local body="$2"
  local labels_csv="$3"
  local milestone_title="$4"

  if issue_exists_exact "$title"; then
    echo "Issue exists: $title"
    return
  fi

  if ! milestone_exists "$milestone_title"; then
    echo "ERROR: milestone not found: $milestone_title"
    exit 1
  fi

  local args=(gh issue create -R "$REPO" --title "$title" --body "$body" --milestone "$milestone_title")

  IFS=',' read -ra lbls <<< "$labels_csv"
  for l in "${lbls[@]}"; do
    l="$(echo "$l" | xargs)"
    [[ -n "$l" ]] && args+=(--label "$l")
  done

  "${args[@]}" >/dev/null
  echo "Created issue: $title"
}

get_issue_number_by_title() {
  local title="$1"
  gh issue list -R "$REPO" --limit 2000 --search "\"$title\" in:title" --json number,title \
    --jq ".[] | select(.title==\"$title\") | .number" | head -n 1
}

# ------------------------------------------------------------
# Project v2 helpers
# ------------------------------------------------------------

project_exists() {
  local title="$1"
  gh project list --owner "$OWNER_LOGIN" --format json --jq '.[].title' | grep -Fxq "$title"
}

create_project() {
  local title="$1"
  if project_exists "$title"; then
    echo "Project exists: $title"
  else
    gh project create --owner "$OWNER_LOGIN" --title "$title" >/dev/null
    echo "Created Project v2: $title"
  fi
}

get_project_number() {
  local title="$1"
  gh project list --owner "$OWNER_LOGIN" --format json \
    --jq ".[] | select(.title==\"$title\") | .number" | head -n 1
}

get_project_id() {
  local number="$1"
  gh project view "$number" --owner "$OWNER_LOGIN" --format json --jq '.id'
}

create_project_field_single_select() {
  local project_id="$1"
  local name="$2"
  shift 2
  local options=("$@")

  local existing
  existing="$(gh api graphql -f query='
    query($project:ID!) {
      node(id:$project) {
        ... on ProjectV2 {
          fields(first:100) {
            nodes {
              ... on ProjectV2FieldCommon { id name }
              ... on ProjectV2SingleSelectField { id name }
            }
          }
        }
      }
    }' -f project="$project_id" --jq ".data.node.fields.nodes[] | select(.name==\"$name\") | .id" 2>/dev/null || true)"

  if [[ -n "$existing" ]]; then
    echo "Project field exists: $name"
    return
  fi

  local opts_json="["
  local first=1
  for opt in "${options[@]}"; do
    if [[ $first -eq 0 ]]; then opts_json+=", "; fi
    opts_json+="{\"name\":\"$opt\",\"color\":\"GRAY\"}"
    first=0
  done
  opts_json+="]"

  gh api graphql -f query='
    mutation($project:ID!, $name:String!, $dataType:ProjectV2CustomFieldType!, $options:[ProjectV2SingleSelectFieldOptionInput!]) {
      createProjectV2Field(input:{
        projectId:$project,
        name:$name,
        dataType:$dataType,
        singleSelectOptions:$options
      }) {
        projectV2Field {
          ... on ProjectV2SingleSelectField { id name }
        }
      }
    }' \
    -f project="$project_id" \
    -f name="$name" \
    -f dataType="SINGLE_SELECT" \
    -f options="$opts_json" >/dev/null

  echo "Created project field: $name"
}

create_project_field_text() {
  local project_id="$1"
  local name="$2"

  local existing
  existing="$(gh api graphql -f query='
    query($project:ID!) {
      node(id:$project) {
        ... on ProjectV2 {
          fields(first:100) {
            nodes {
              ... on ProjectV2FieldCommon { id name }
            }
          }
        }
      }
    }' -f project="$project_id" --jq ".data.node.fields.nodes[] | select(.name==\"$name\") | .id" 2>/dev/null || true)"

  if [[ -n "$existing" ]]; then
    echo "Project field exists: $name"
    return
  fi

  gh api graphql -f query='
    mutation($project:ID!, $name:String!, $dataType:ProjectV2CustomFieldType!) {
      createProjectV2Field(input:{
        projectId:$project,
        name:$name,
        dataType:$dataType
      }) {
        projectV2Field {
          ... on ProjectV2FieldCommon { id name }
        }
      }
    }' \
    -f project="$project_id" \
    -f name="$name" \
    -f dataType="TEXT" >/dev/null

  echo "Created project field: $name"
}

get_project_field_id_by_name() {
  local project_id="$1"
  local field_name="$2"
  gh api graphql -f query='
    query($project:ID!) {
      node(id:$project) {
        ... on ProjectV2 {
          fields(first:100) {
            nodes {
              ... on ProjectV2FieldCommon { id name }
              ... on ProjectV2SingleSelectField { id name options { id name } }
            }
          }
        }
      }
    }' \
    -f project="$project_id" \
    --jq ".data.node.fields.nodes[] | select(.name==\"$field_name\") | .id" | head -n 1
}

get_project_field_option_id() {
  local project_id="$1"
  local field_name="$2"
  local option_name="$3"
  gh api graphql -f query='
    query($project:ID!) {
      node(id:$project) {
        ... on ProjectV2 {
          fields(first:100) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
        }
      }
    }' \
    -f project="$project_id" \
    --jq ".data.node.fields.nodes[] | select(.name==\"$field_name\") | .options[] | select(.name==\"$option_name\") | .id" | head -n 1
}

get_issue_node_id() {
  local issue_number="$1"
  gh api graphql -f query='
    query($owner:String!, $repo:String!, $number:Int!) {
      repository(owner:$owner, name:$repo) {
        issue(number:$number) { id }
      }
    }' \
    -f owner="${REPO%/*}" \
    -f repo="${REPO#*/}" \
    -F number="$issue_number" \
    --jq '.data.repository.issue.id'
}

add_issue_to_project() {
  local project_id="$1"
  local issue_node_id="$2"

  gh api graphql -f query='
    mutation($project:ID!, $content:ID!) {
      addProjectV2ItemById(input:{projectId:$project, contentId:$content}) {
        item { id }
      }
    }' \
    -f project="$project_id" \
    -f content="$issue_node_id" \
    --jq '.data.addProjectV2ItemById.item.id'
}

set_single_select_field() {
  local project_id="$1"
  local item_id="$2"
  local field_id="$3"
  local option_id="$4"

  gh api graphql -f query='
    mutation($project:ID!, $item:ID!, $field:ID!, $option:String!) {
      updateProjectV2ItemFieldValue(input:{
        projectId:$project,
        itemId:$item,
        fieldId:$field,
        value:{ singleSelectOptionId:$option }
      }) {
        projectV2Item { id }
      }
    }' \
    -f project="$project_id" \
    -f item="$item_id" \
    -f field="$field_id" \
    -f option="$option_id" >/dev/null
}

set_text_field() {
  local project_id="$1"
  local item_id="$2"
  local field_id="$3"
  local text="$4"

  gh api graphql -f query='
    mutation($project:ID!, $item:ID!, $field:ID!, $text:String!) {
      updateProjectV2ItemFieldValue(input:{
        projectId:$project,
        itemId:$item,
        fieldId:$field,
        value:{ text:$text }
      }) {
        projectV2Item { id }
      }
    }' \
    -f project="$project_id" \
    -f item="$item_id" \
    -f field="$field_id" \
    -f text="$text" >/dev/null
}

# ------------------------------------------------------------
# Labels
# ------------------------------------------------------------
echo "==> Creating labels..."

create_label "area:core" "0E8A16" "Core Worker"
create_label "area:ledger" "1D76DB" "Ledger Worker"
create_label "area:notify" "5319E7" "Notification Worker"
create_label "area:treasury" "FBCA04" "Treasury and FX"
create_label "area:fx" "FAD8C7" "FX providers and caching"
create_label "area:checkout" "B60205" "Checkout UX"
create_label "area:dashboard" "0052CC" "Business Dashboard"
create_label "area:superadmin" "006B75" "Superadmin Dashboard"
create_label "area:i18n" "C2E0C6" "Localization"
create_label "area:security" "D93F0B" "Security"
create_label "area:infra" "A2EEEF" "Infrastructure"
create_label "area:docs" "F9D0C4" "Documentation"
create_label "area:testing" "E99695" "Testing"
create_label "area:observability" "9A6700" "Observability"

create_label "type:epic" "3E4B9E" "Epic"
create_label "type:task" "C5DEF5" "Task"
create_label "type:bug" "D73A4A" "Bug"
create_label "type:docs" "0075CA" "Documentation"

create_label "prio:P0" "B60205" "Must have"
create_label "prio:P1" "FBCA04" "High"
create_label "prio:P2" "0E8A16" "Medium"
create_label "prio:P3" "C2E0C6" "Low"

# ------------------------------------------------------------
# Milestones
# ------------------------------------------------------------
echo "==> Creating milestones..."

create_milestone "M0 — Repo + Docs Source of Truth" "Repo structure, docs, prompts"
create_milestone "M1 — Infra + Environments" "Cloudflare resources, migrations, CI/CD"
create_milestone "M2 — Core MVP" "Intents, Quotes, Checkout, mode enforcement"
create_milestone "M3 — Ledger MVP" "Append-only journals + balances"
create_milestone "M4 — Notifications + Webhooks" "Outbox, retries, logs, resend"
create_milestone "M5 — Treasury/FX" "Multi-route batches + settlement"
create_milestone "M6 — Dashboards" "Business + Superadmin, mobile-first"
create_milestone "M7 — Hardening" "Security, perf, smoke tests"
create_milestone "M8 — Go-Live + Runbooks" "Runbooks, observability, support"

# ------------------------------------------------------------
# Issues
# ------------------------------------------------------------
echo "==> Creating issues..."

create_issue \
"EPIC: Docs as source of truth" \
"## Goal
Make docs the single source of truth for Codex and engineers.

## Scope
- environments.md
- security.md
- webhooks.md
- events/v1.md
- i18n/keys.md
- openapi/v1.yaml
- wrangler/migrations

## Acceptance
- All files exist
- MASTER prompt references them
- Repo committed
" \
"type:epic,area:docs,prio:P0" \
"M0 — Repo + Docs Source of Truth"

create_issue \
"Task: Finalize base docs content" \
"## Objective
Complete and commit the core documentation files.

## Acceptance
- docs files complete
- reviewed for consistency
- committed to main
" \
"type:task,area:docs,prio:P0" \
"M0 — Repo + Docs Source of Truth"

create_issue \
"Task: Add prompts/MASTER.md and prompt conventions" \
"## Objective
Create Codex prompt system tied to source-of-truth docs.

## Acceptance
- prompts/MASTER.md exists
- references docs + wrangler/migrations
" \
"type:task,area:docs,prio:P0" \
"M0 — Repo + Docs Source of Truth"

create_issue \
"EPIC: Cloudflare infra and environment setup" \
"## Goal
Provision all environment resources and CI/CD.

## Scope
- D1 staging/prod
- Queues
- R2
- Wrangler configs
- GitHub Actions

## Acceptance
- staging and prod deployable
" \
"type:epic,area:infra,prio:P0" \
"M1 — Infra + Environments"

create_issue \
"Task: Create D1 databases and apply migrations" \
"## Objective
Provision pagooz_d1_staging and pagooz_d1_prod and apply wrangler/migrations/0001 and 0002.

## Acceptance
- migrations apply without errors
" \
"type:task,area:infra,prio:P0" \
"M1 — Infra + Environments"

create_issue \
"Task: Create queues and R2 buckets" \
"## Objective
Provision ledger/notification/webhook queues and artifacts buckets.

## Acceptance
- resource names documented
- bindings ready for wrangler
" \
"type:task,area:infra,prio:P0" \
"M1 — Infra + Environments"

create_issue \
"Task: Add wrangler configs for core/ledger/notification" \
"## Objective
Create staging/prod TOML configs with correct bindings.

## Acceptance
- core/ledger/notification deploy commands work
" \
"type:task,area:infra,prio:P0" \
"M1 — Infra + Environments"

create_issue \
"Task: GitHub Actions for PR/staging/prod" \
"## Objective
Set up CI/CD with tests and deployments.

## Acceptance
- PR runs tests
- main deploys staging
- tagged release deploys prod
" \
"type:task,area:infra,area:testing,prio:P0" \
"M1 — Infra + Environments"

create_issue \
"EPIC: Core MVP with sandbox/live enforcement" \
"## Goal
Implement Core Worker MVP.

## Scope
- Auth/RBAC middleware
- tenant resolution
- sandbox/live mode isolation
- payment_intents
- quotes
- checkout_sessions
- i18n baseline

## Acceptance
- end-to-end create intent -> quote -> checkout works
- sandbox/live never mix
" \
"type:epic,area:core,area:security,area:i18n,prio:P0" \
"M2 — Core MVP"

create_issue \
"Task: Core middleware (tenant, mode, RBAC, idempotency)" \
"## Objective
Implement mandatory Core middlewares.

## Acceptance
- all mutating endpoints require idempotency
- mode enforced on all business queries
- audit on sensitive actions
" \
"type:task,area:core,area:security,prio:P0" \
"M2 — Core MVP"

create_issue \
"Task: Economic Engine v1" \
"## Objective
Implement fee_strategy, breakdown, tax hooks, and output contract.

## Acceptance
- payer_total and receiver_net returned
- tested scenarios pass
" \
"type:task,area:core,area:fx,prio:P0" \
"M2 — Core MVP"

create_issue \
"Task: FX rate service with free providers + caching" \
"## Objective
Implement AwesomeAPI + Frankfurter fallback with signed quote storage.

## Acceptance
- caching 30-60s
- provider and timestamp persisted
" \
"type:task,area:fx,area:core,prio:P0" \
"M2 — Core MVP"

create_issue \
"Task: Implement payment_intents / quotes / checkout_sessions endpoints" \
"## Objective
Implement OpenAPI endpoints with validation and D1 persistence.

## Acceptance
- 201/4xx responses follow contract
- tests pass
" \
"type:task,area:core,prio:P0" \
"M2 — Core MVP"

create_issue \
"EPIC: Ledger append-only worker" \
"## Goal
Create Ledger Worker consuming journal commands and updating balances.

## Acceptance
- debit equals credit validation
- append-only entries
- balances updated
- journal posted event emitted
" \
"type:epic,area:ledger,prio:P0" \
"M3 — Ledger MVP"

create_issue \
"Task: ledger.post_entries consumer and validation" \
"## Objective
Consume q.ledger.commands and validate journals strictly.

## Acceptance
- duplicate journal idempotent
- invalid journal rejected
" \
"type:task,area:ledger,prio:P0" \
"M3 — Ledger MVP"

create_issue \
"Task: account_balances updater + ledger.journal_posted" \
"## Objective
Maintain fast balances and publish ledger completion events.

## Acceptance
- balances query fast
- event emitted once
" \
"type:task,area:ledger,prio:P0" \
"M3 — Ledger MVP"

create_issue \
"EPIC: Notification + Webhook outbox worker" \
"## Goal
Deliver emails and webhooks asynchronously with retries and logs.

## Acceptance
- email by locale + scope
- signed webhooks
- retries + DLQ
- resend supported
" \
"type:epic,area:notify,area:i18n,prio:P0" \
"M4 — Notifications + Webhooks"

create_issue \
"Task: Notification outbox consumer" \
"## Objective
Render and send email/sms/whatsapp using queued commands.

## Acceptance
- dedupe_key enforced
- delivery logs persisted
" \
"type:task,area:notify,area:i18n,prio:P0" \
"M4 — Notifications + Webhooks"

create_issue \
"Task: Webhook delivery engine" \
"## Objective
Deliver HMAC-signed webhooks with retries and delivery logs.

## Acceptance
- 18 attempts max
- backoff+jitter
- manual resend works
" \
"type:task,area:notify,area:security,prio:P0" \
"M4 — Notifications + Webhooks"

create_issue \
"EPIC: Treasury/FX multi-route batches" \
"## Goal
Implement FX batch orchestration with multi-route support.

## Acceptance
- create batch
- define routes
- execute/settle
- emit ledger commands
- audit everything
" \
"type:epic,area:treasury,prio:P0" \
"M5 — Treasury/FX"

create_issue \
"Task: Create FX batch and define routes" \
"## Objective
Implement batch creation and routes_defined flow.

## Acceptance
- totals validate
- legal_entity and permissions enforced
" \
"type:task,area:treasury,prio:P0" \
"M5 — Treasury/FX"

create_issue \
"Task: Execute and settle FX routes" \
"## Objective
Implement route execution and settlement confirmation.

## Acceptance
- status transitions valid
- ledger commands emitted
" \
"type:task,area:treasury,prio:P0" \
"M5 — Treasury/FX"

create_issue \
"EPIC: Dashboards with 3-click UX" \
"## Goal
Build mobile-first business and superadmin dashboards.

## Acceptance
- business: home/create/payments/payouts/developers
- superadmin: tenants/search/treasury/audit
- most flows <= 3 clicks
" \
"type:epic,area:dashboard,area:superadmin,prio:P1" \
"M6 — Dashboards"

create_issue \
"Task: Business dashboard skeleton + Sandbox/Live toggle" \
"## Objective
Implement core business dashboard navigation and mode toggle.

## Acceptance
- URL preserves mode and filters
- no context loss on back navigation
" \
"type:task,area:dashboard,area:i18n,prio:P1" \
"M6 — Dashboards"

create_issue \
"Task: Superadmin ops dashboard skeleton" \
"## Objective
Implement tenants/search/treasury/audit screens.

## Acceptance
- can inspect core entities quickly
" \
"type:task,area:superadmin,prio:P1" \
"M6 — Dashboards"

create_issue \
"EPIC: Hardening security/performance/QA" \
"## Goal
Prepare the platform for production.

## Acceptance
- WAF rules
- rate limits
- dual approvals
- smoke tests
- performance baseline
" \
"type:epic,area:security,area:testing,prio:P0" \
"M7 — Hardening"

create_issue \
"Task: Configure Cloudflare WAF + rate limits" \
"## Objective
Add WAF/rate limiting per endpoint and tenant.

## Acceptance
- auth and checkout protected
- treasury endpoints stricter
" \
"type:task,area:security,prio:P0" \
"M7 — Hardening"

create_issue \
"Task: Smoke tests for critical flows" \
"## Objective
Automate smoke tests for staging and prod.

## Acceptance
- create intent -> quote -> checkout
- ledger journal command path
- notification/webhook outbox path
" \
"type:task,area:testing,prio:P0" \
"M7 — Hardening"

create_issue \
"EPIC: Go-live playbooks and observability" \
"## Goal
Create runbooks, metrics, and incident handling before go-live.

## Acceptance
- treasury runbook
- support runbook
- basic observability documented
" \
"type:epic,area:docs,area:observability,prio:P1" \
"M8 — Go-Live + Runbooks"

create_issue \
"Task: Treasury and support runbooks" \
"## Objective
Document operating procedures and escalation paths.

## Acceptance
- written and committed
" \
"type:task,area:docs,prio:P1" \
"M8 — Go-Live + Runbooks"

# ------------------------------------------------------------
# Project v2
# ------------------------------------------------------------
echo "==> Creating Project v2..."
create_project "$PROJECT_TITLE"

PROJECT_NUMBER="$(get_project_number "$PROJECT_TITLE")"
PROJECT_ID="$(get_project_id "$PROJECT_NUMBER")"

echo "Project number: $PROJECT_NUMBER"
echo "Project id: $PROJECT_ID"

# ------------------------------------------------------------
# Project fields
# ------------------------------------------------------------
echo "==> Creating Project fields..."

create_project_field_single_select "$PROJECT_ID" "Status" "Backlog" "Ready" "In Progress" "Review" "Done" "Blocked"
create_project_field_single_select "$PROJECT_ID" "Priority" "P0" "P1" "P2" "P3"
create_project_field_single_select "$PROJECT_ID" "Area" \
  "Core" "Ledger" "Notify" "Treasury" "FX" "Checkout" "Dashboard" "Superadmin" "I18N" "Security" "Infra" "Docs" "Testing" "Observability"
create_project_field_text "$PROJECT_ID" "Milestone"

STATUS_FIELD_ID="$(get_project_field_id_by_name "$PROJECT_ID" "Status")"
PRIORITY_FIELD_ID="$(get_project_field_id_by_name "$PROJECT_ID" "Priority")"
AREA_FIELD_ID="$(get_project_field_id_by_name "$PROJECT_ID" "Area")"
MILESTONE_FIELD_ID="$(get_project_field_id_by_name "$PROJECT_ID" "Milestone")"

STATUS_BACKLOG_ID="$(get_project_field_option_id "$PROJECT_ID" "Status" "Backlog")"
PRIO_P0_ID="$(get_project_field_option_id "$PROJECT_ID" "Priority" "P0")"
PRIO_P1_ID="$(get_project_field_option_id "$PROJECT_ID" "Priority" "P1")"
PRIO_P2_ID="$(get_project_field_option_id "$PROJECT_ID" "Priority" "P2")"
PRIO_P3_ID="$(get_project_field_option_id "$PROJECT_ID" "Priority" "P3")"

AREA_CORE_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Core")"
AREA_LEDGER_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Ledger")"
AREA_NOTIFY_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Notify")"
AREA_TREASURY_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Treasury")"
AREA_FX_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "FX")"
AREA_CHECKOUT_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Checkout")"
AREA_DASHBOARD_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Dashboard")"
AREA_SUPERADMIN_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Superadmin")"
AREA_I18N_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "I18N")"
AREA_SECURITY_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Security")"
AREA_INFRA_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Infra")"
AREA_DOCS_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Docs")"
AREA_TESTING_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Testing")"
AREA_OBS_ID="$(get_project_field_option_id "$PROJECT_ID" "Area" "Observability")"

# ------------------------------------------------------------
# Add issues to project + populate fields
# ------------------------------------------------------------
echo "==> Adding issues to Project v2..."

add_issue_with_fields() {
  local title="$1"
  local prio="$2"
  local area="$3"
  local milestone="$4"

  local issue_number issue_node_id item_id prio_opt area_opt

  issue_number="$(get_issue_number_by_title "$title")"
  [[ -z "$issue_number" ]] && { echo "Missing issue: $title"; return; }

  issue_node_id="$(get_issue_node_id "$issue_number")"
  item_id="$(add_issue_to_project "$PROJECT_ID" "$issue_node_id")"

  set_single_select_field "$PROJECT_ID" "$item_id" "$STATUS_FIELD_ID" "$STATUS_BACKLOG_ID"

  case "$prio" in
    P0) prio_opt="$PRIO_P0_ID" ;;
    P1) prio_opt="$PRIO_P1_ID" ;;
    P2) prio_opt="$PRIO_P2_ID" ;;
    P3) prio_opt="$PRIO_P3_ID" ;;
    *) prio_opt="$PRIO_P2_ID" ;;
  esac
  set_single_select_field "$PROJECT_ID" "$item_id" "$PRIORITY_FIELD_ID" "$prio_opt"

  case "$area" in
    Core) area_opt="$AREA_CORE_ID" ;;
    Ledger) area_opt="$AREA_LEDGER_ID" ;;
    Notify) area_opt="$AREA_NOTIFY_ID" ;;
    Treasury) area_opt="$AREA_TREASURY_ID" ;;
    FX) area_opt="$AREA_FX_ID" ;;
    Checkout) area_opt="$AREA_CHECKOUT_ID" ;;
    Dashboard) area_opt="$AREA_DASHBOARD_ID" ;;
    Superadmin) area_opt="$AREA_SUPERADMIN_ID" ;;
    I18N) area_opt="$AREA_I18N_ID" ;;
    Security) area_opt="$AREA_SECURITY_ID" ;;
    Infra) area_opt="$AREA_INFRA_ID" ;;
    Docs) area_opt="$AREA_DOCS_ID" ;;
    Testing) area_opt="$AREA_TESTING_ID" ;;
    Observability) area_opt="$AREA_OBS_ID" ;;
    *) area_opt="$AREA_DOCS_ID" ;;
  esac
  set_single_select_field "$PROJECT_ID" "$item_id" "$AREA_FIELD_ID" "$area_opt"

  set_text_field "$PROJECT_ID" "$item_id" "$MILESTONE_FIELD_ID" "$milestone"

  echo "Added to project: $title"
}

add_issue_with_fields "EPIC: Docs as source of truth" "P0" "Docs" "M0"
add_issue_with_fields "Task: Finalize base docs content" "P0" "Docs" "M0"
add_issue_with_fields "Task: Add prompts/MASTER.md and prompt conventions" "P0" "Docs" "M0"

add_issue_with_fields "EPIC: Cloudflare infra and environment setup" "P0" "Infra" "M1"
add_issue_with_fields "Task: Create D1 databases and apply migrations" "P0" "Infra" "M1"
add_issue_with_fields "Task: Create queues and R2 buckets" "P0" "Infra" "M1"
add_issue_with_fields "Task: Add wrangler configs for core/ledger/notification" "P0" "Infra" "M1"
add_issue_with_fields "Task: GitHub Actions for PR/staging/prod" "P0" "Testing" "M1"

add_issue_with_fields "EPIC: Core MVP with sandbox/live enforcement" "P0" "Core" "M2"
add_issue_with_fields "Task: Core middleware (tenant, mode, RBAC, idempotency)" "P0" "Security" "M2"
add_issue_with_fields "Task: Economic Engine v1" "P0" "Core" "M2"
add_issue_with_fields "Task: FX rate service with free providers + caching" "P0" "FX" "M2"
add_issue_with_fields "Task: Implement payment_intents / quotes / checkout_sessions endpoints" "P0" "Core" "M2"

add_issue_with_fields "EPIC: Ledger append-only worker" "P0" "Ledger" "M3"
add_issue_with_fields "Task: ledger.post_entries consumer and validation" "P0" "Ledger" "M3"
add_issue_with_fields "Task: account_balances updater + ledger.journal_posted" "P0" "Ledger" "M3"

add_issue_with_fields "EPIC: Notification + Webhook outbox worker" "P0" "Notify" "M4"
add_issue_with_fields "Task: Notification outbox consumer" "P0" "Notify" "M4"
add_issue_with_fields "Task: Webhook delivery engine" "P0" "Notify" "M4"

add_issue_with_fields "EPIC: Treasury/FX multi-route batches" "P0" "Treasury" "M5"
add_issue_with_fields "Task: Create FX batch and define routes" "P0" "Treasury" "M5"
add_issue_with_fields "Task: Execute and settle FX routes" "P0" "Treasury" "M5"

add_issue_with_fields "EPIC: Dashboards with 3-click UX" "P1" "Dashboard" "M6"
add_issue_with_fields "Task: Business dashboard skeleton + Sandbox/Live toggle" "P1" "Dashboard" "M6"
add_issue_with_fields "Task: Superadmin ops dashboard skeleton" "P1" "Superadmin" "M6"

add_issue_with_fields "EPIC: Hardening security/performance/QA" "P0" "Security" "M7"
add_issue_with_fields "Task: Configure Cloudflare WAF + rate limits" "P0" "Security" "M7"
add_issue_with_fields "Task: Smoke tests for critical flows" "P0" "Testing" "M7"

add_issue_with_fields "EPIC: Go-live playbooks and observability" "P1" "Observability" "M8"
add_issue_with_fields "Task: Treasury and support runbooks" "P1" "Docs" "M8"

echo
echo "==> Done."
echo "Project URL:"
gh project view "$PROJECT_NUMBER" --owner "$OWNER_LOGIN"
