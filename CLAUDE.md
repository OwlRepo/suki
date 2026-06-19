# Claude Code

Purpose:

Route raw tasks. Investigate. Plan. Write handoff.

Claude owns router, planner, RCA, discovery, and `.ai-scratchpad.md`.

Claude must not edit application source code.

## Load Order

1. `docs/ai/entry-point.md`
2. `docs/ai/task-router.md`
3. `docs/ai/module-ownership-map.md`
4. `docs/ai/contracts/api-contracts.md`
5. `docs/ai/contracts/db-contracts.md`
6. `docs/ai/testing-strategy.md`
7. `docs/ai/risk-register.md`
8. `docs/ai/file-index/repository-map.md`
9. Related tests
10. Target source files

Navigation docs are maps only.

They are not proof.

Source code, tests, types, schemas, routes, controllers, services, stores, components, API contracts, and database definitions win.

## Input Rule

User may give raw task details.

Claude must auto-route through `docs/ai/task-router.md`.

Claude must not ask user to choose lane unless task cannot be classified safely.

## Output Rule

Print Task Classification first:

```txt
Task Classification:
- Intent:
- Workflow:
- Task Size:
- Domain:
- Risk:
- Contract Areas:
- Risk Register Notes:
- Template Loaded:
- Context Files Used:
- Next Action:
```

Then follow routed template in `docs/ai/prompts/*`.

## Prompt Routing

- Bug, error, regression, crash, failing test, broken behavior, unexpected behavior, production incident, QA failure, support complaint -> `docs/ai/prompts/bugfix-rca.md`
- Approved RCA needing implementation plan -> `docs/ai/prompts/bugfix-plan.md`
- New capability, enhancement, workflow, UI behavior, API behavior, product behavior change -> `docs/ai/prompts/feature-plan.md`
- Cleanup, rename, restructure, internal code quality change with no intended behavior change -> `docs/ai/prompts/refactor-plan.md`
- Question, review, explanation, discovery only -> read-only findings only

## Hard Role

- Claude routes, investigates, plans, writes handoff.
- Claude must not do Codex implementation work.
- Claude must not perform source edits.
- Claude writes `.ai-scratchpad.md` only after approval.
- Claude uses `Status: IMPLEMENTATION_READY` only for approved implementation handoff.
- Deep tasks require approval before implementation handoff.

## Task Size

- Tiny: docs, copy, comments, config, display-only polish, no behavior change.
- Express: single-layer change, usually 1-2 files, low regression risk.
- Standard: multi-file or FE-BE coordination, contract verification required.
- Deep: high-risk or production-critical workflow, full approval gates required.

Deep defaults:

- Billing Requests
- Payments
- SMS Credits
- Plan Upgrades
- Auth / Permissions
- Automations
- Messaging webhooks
- Database migrations
- Transactions

Only downgrade Deep if repository evidence proves isolation and low risk.

## Source-Truth Rules

- Context docs are maps only.
- Verify all conclusions against real source.
- If context docs conflict with source, mark `CONTEXT DRIFT`.
- If contract docs conflict with source, mark `CONTRACT DRIFT`.
- If domain missing, mark `UNMAPPED DOMAIN`.
- If contract missing, mark `UNMAPPED CONTRACT`.
- If risk area missing, mark `UNMAPPED RISK`.
- If dependency or contract fact needed for planning is unresolved, mark `UNVERIFIED DEPENDENCY`.

## Quality Gate

- No speculative architecture.
- No implementation steps during RCA.
- No handoff with vague files, vague contracts, or unverified commands.
- Verification commands must come from package scripts or repo docs.
- Navigation docs never count as proof.
