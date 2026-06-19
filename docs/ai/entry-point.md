# AI Entry Point

Purpose:

Start here for repository AI workflow.

This file is map only.

It is not proof of behavior.

Verify final conclusions against real source code, tests, types, schemas, routes, controllers, services, stores, components, API contracts, and database definitions.

## Developer Workflow

Planner flow:

```txt
Handle this task:

[paste details]
```

After Claude discovery or plan approval:

```txt
Approved. Create implementation handoff.
```

Executor flow:

```txt
Implement from `.ai-scratchpad.md`.
```

Validation flow:

```txt
Validate from `.ai-scratchpad.md`.
```

## Split Brain

- Claude routes, investigates, plans, writes handoff.
- Codex implements and validates only from `.ai-scratchpad.md`.
- Human approval required before risky implementation handoff.

## Context Engineering

- `docs/ai/task-router.md` classifies raw requests.
- `docs/ai/module-ownership-map.md` maps business domains.
- `docs/ai/file-index/repository-map.md` maps paths.
- `docs/ai/architecture-manifest.md` maps repo shape and boundaries.
- Navigation docs are maps only. They are not proof.

## Contract Engineering

- `docs/ai/contracts/api-contracts.md` maps FE-BE contracts.
- `docs/ai/contracts/db-contracts.md` maps DB models and invariants.
- `docs/ai/testing-strategy.md` maps verification depth.
- `docs/ai/risk-register.md` maps Deep-risk areas.
- `docs/ai/context-refresh.md` defines stale-doc refresh flow.

## Load Order

1. `docs/ai/task-router.md`
2. `docs/ai/module-ownership-map.md`
3. `docs/ai/contracts/api-contracts.md`
4. `docs/ai/contracts/db-contracts.md`
5. `docs/ai/testing-strategy.md`
6. `docs/ai/risk-register.md`
7. `docs/ai/file-index/repository-map.md`
8. Related tests
9. Target source files

Read least context needed.

## Prompt Routes

- Bug RCA -> `docs/ai/prompts/bugfix-rca.md`
- Approved bug plan -> `docs/ai/prompts/bugfix-plan.md`
- Feature discovery and plan -> `docs/ai/prompts/feature-plan.md`
- Behavior-preserving refactor plan -> `docs/ai/prompts/refactor-plan.md`

## Source Verification Rule

- Source code wins over docs.
- Mark `CONTEXT DRIFT` when navigation docs conflict with code.
- Mark `CONTRACT DRIFT` when contract docs conflict with code.
- Mark `UNMAPPED DOMAIN`, `UNMAPPED CONTRACT`, or `UNMAPPED RISK` when coverage is missing.
