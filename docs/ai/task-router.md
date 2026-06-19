# Task Router

Purpose:

Classify raw task input.

This file is map only.

It is not proof of behavior.

## Raw Task Input Rule

Developer may paste plain English, bug report, feature request, refactor note, QA failure, issue tracker text, stack trace, screenshot description, support report, or code review comment.

Do not require user to name lane.

## Router Steps

1. Classify intent.
2. Look up domain in `docs/ai/module-ownership-map.md`.
3. Look up API contracts in `docs/ai/contracts/api-contracts.md` when FE-BE boundary exists.
4. Look up DB contracts in `docs/ai/contracts/db-contracts.md` when schema, model, mutation, billing, credits, jobs, webhooks, or transactions may matter.
5. Look up verification depth in `docs/ai/testing-strategy.md`.
6. Look up risk in `docs/ai/risk-register.md`.
7. Verify all map assumptions against real source.

## Classification Table

| Input Intent | Internal Workflow | Template |
|---|---|---|
| Bug, error, regression, crash, failing test, broken behavior, unexpected behavior, production incident, QA failure, support complaint | Bug RCA | `docs/ai/prompts/bugfix-rca.md` |
| Approved RCA needing implementation plan | Bug Plan | `docs/ai/prompts/bugfix-plan.md` |
| New capability, enhancement, workflow, UI behavior, API behavior, product behavior change | Feature Plan | `docs/ai/prompts/feature-plan.md` |
| Cleanup, rename, restructure, internal code quality change, no intended behavior change | Refactor Plan | `docs/ai/prompts/refactor-plan.md` |
| Question, explanation, code review, architecture review, discovery only | Read-only | No scratchpad unless user asks |

## Task Size Rules

- Tiny: docs, copy, comments, config, display-only polish.
- Express: single-layer, low-risk, usually 1-2 files.
- Standard: multi-file or FE-BE coordination.
- Deep: billing, payments, SMS credits, plan upgrades, auth, permissions, automations, jobs, webhooks, migrations, transactions, or other production-critical flow.

Deep defaults stay Deep unless repository evidence proves isolated low risk.

## Ambiguity Rules

- Possible bug -> Bug RCA.
- Possible product behavior addition -> Feature Plan.
- Possible cleanup with no behavior change -> Refactor Plan.
- Possible billing, payments, SMS credits, auth, roles, permissions, automations, jobs, webhooks, migrations, transactions -> Deep.

## Drift And Missing Rules

- Missing domain -> `UNMAPPED DOMAIN`
- Missing contract -> `UNMAPPED CONTRACT`
- Missing risk area -> `UNMAPPED RISK`
- Navigation doc stale vs source -> `CONTEXT DRIFT`
- Contract doc stale vs source -> `CONTRACT DRIFT`

## Output Classification Block

Print first:

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

## Approval Rules

- RCA stops for approval before bugfix plan.
- Deep discovery stops for approval before implementation handoff.
- `.ai-scratchpad.md` write allowed only after approval.
- `Status: IMPLEMENTATION_READY` allowed only for approved handoff.

