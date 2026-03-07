# i18n Key Strategy

## Goals
- stable keys across releases
- deterministic fallback behavior
- safe incremental locale rollout

## Key Design
- Keys are namespaced by domain, resource, and scenario.
- Keys are immutable identifiers; message text can evolve.
- API and webhook surfaces should return keys plus contextual data when applicable.

## Fallback Rules
1. explicit locale requested by client/user
2. tenant default locale
3. platform default locale (`en`)

## Versioning
- New keys are additive.
- Deprecated keys remain until all active clients are migrated.
- Breaking key removals require coordinated release notes.
