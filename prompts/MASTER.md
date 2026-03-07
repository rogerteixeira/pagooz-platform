# Master Prompt Contract

Use this file as the root contract for Codex-guided implementation in this repository.

## Required Context
- Architecture is fixed to Core Worker, Ledger Worker, Notification Worker.
- Environment model is fixed to `local`, `dev`, `staging`, `prod`.
- Business mode model is fixed to `sandbox`, `live`.
- Migrations are canonical in `wrangler/migrations`.

## Prompt Hygiene
- Prefer deterministic file paths and explicit commands.
- Require tenant/mode safety checks on business endpoints.
- Keep queue semantics separated (domain events vs delivery commands vs ledger commands).
- Update tests with every behavior-changing code modification.
