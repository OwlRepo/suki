# AI Entry Point

Purpose:

Start here for repository AI workflow.

This file is map only.

It is not proof of behavior.

Verify final conclusions against real source code, tests, types, schemas, routes, controllers, services, stores, components, API contracts, and database definitions.

## Developer Workflow

One agent owns a task end to end, following the Canonical Task Flow in `AGENTS.md`:

```txt
Handle this task:

[paste details]
```

1. Route (`docs/ai/task-router.md`) and print the Task Classification block.
2. Bug → RCA first (`docs/ai/prompts/bugfix-rca.md`), stop for approval.
3. Plan (`docs/ai/planning.md` + `docs/ai/plan-template.md`), stop for approval.
4. Execute in a fresh worktree (`docs/ai/execution.md`): approved plan committed to `docs/plans/<branch>.md`, RED tests (`bun run tdd:red`), implementation, validation.
5. Hand off (`docs/ai/handoff.md`): PR into `main`, CI green, final report. Merging is the user's call.

Human approval is required before implementation and before any `BREAKING CHANGE`. The retired planner/executor handoff file (`.ai-scratchpad.md`) is gone.

## Phase Docs

- `docs/ai/planning.md`, `docs/ai/plan-template.md` — flow node L.
- `docs/ai/execution.md` — flow node S.
- `docs/ai/handoff.md`, `docs/ai/pr-evidence.md` — flow node W.
- `docs/ai/agent-orchestration.md` — multi-agent FE/BE dispatch.
- `docs/ai/dev-environment.md` — local stack, DB lifecycle, production deploy.
- `docs/ai/autonomous-engineering.md` + `.ai-engineering/` — autonomy level and lifecycle.

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
