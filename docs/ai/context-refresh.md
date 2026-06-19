# Context Refresh

Purpose:

Refresh AI navigation and contract docs without changing source code.

## Scope

- Read source only.
- Edit only AI context docs under `docs/ai`, plus root AI workflow files when user explicitly asks.
- No application source edits.
- No feature work.
- No implementation planning.

## Files To Refresh

- `docs/ai/architecture-manifest.md`
- `docs/ai/module-ownership-map.md`
- `docs/ai/contracts/api-contracts.md`
- `docs/ai/contracts/db-contracts.md`
- `docs/ai/testing-strategy.md`
- `docs/ai/risk-register.md`
- `docs/ai/file-index/repository-map.md`

## Source Verification Rules

- Docs are maps only.
- Verify against real source code, tests, types, schemas, routes, controllers, services, stores, components, API contracts, database definitions, and repo docs.
- If docs conflict with source, source wins.
- Do not invent missing facts.

## Drift Markers

- `CONTEXT DRIFT` for stale navigation docs
- `CONTRACT DRIFT` for stale API, DB, test, or risk docs
- `UNMAPPED DOMAIN` for missing domain coverage
- `UNMAPPED CONTRACT` for missing contract coverage
- `UNMAPPED RISK` for missing risk coverage
- `TODO: Fill after repository analysis. Do not treat as verified.` for unknown but needed map fields

## Refresh Steps

1. Read current AI docs.
2. Inspect repo manifests, source, tests, schema, and workflows.
3. Compare docs to verified source facts.
4. Update stale rows and sections only.
5. Keep useful project-specific conventions.
6. Re-check changed docs for internal consistency.
7. Report drift found and files changed.

## Output Summary

Report:

1. Files refreshed
2. Drift markers added
3. Unknowns left as TODO
4. Verification sources used

