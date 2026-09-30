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

## Classification Enums

Classify each task exactly once. Intent enum: `BUG_FIX` · `ENHANCEMENT` · `NEW_FEATURE` · `REFACTOR` · `PERFORMANCE` · `INFRASTRUCTURE` · `DOCUMENTATION`. Complexity: `SMALL` · `MEDIUM` · `LARGE`. The Task Size lanes below (Tiny/Express/Standard/Deep) set the verification depth.

## Classification Table

| Input Intent | Internal Workflow | Template |
|---|---|---|
| Bug, error, regression, crash, failing test, broken behavior, unexpected behavior, production incident, QA failure, support complaint | Bug RCA | `docs/ai/prompts/bugfix-rca.md` |
| Approved RCA needing implementation plan | Bug Plan | `docs/ai/prompts/bugfix-plan.md` |
| New capability, enhancement, workflow, UI behavior, API behavior, product behavior change | Feature Plan | `docs/ai/prompts/feature-plan.md` |
| Cleanup, rename, restructure, internal code quality change, no intended behavior change | Refactor Plan | `docs/ai/prompts/refactor-plan.md` |
| Question, explanation, code review, architecture review, discovery only | Read-only | No plan, no file changes |
| Performance | Performance analysis | required analysis below |
| Docker / CI / deploy / infra config | Infrastructure analysis (Deep by default) | required analysis below |
| Documentation | Documentation analysis | required analysis below |

## Skill Map

| Intent | Skill |
|---|---|
| Bug RCA | `/investigate` |
| Enhancement | `ecc:plan` |
| New feature | `ecc:feature-dev` |
| Review of a diff | `ecc:code-review` or `/review` |
| QA | `/qa` (fix), `/qa-only` (report), `ecc:test-coverage` |
| Architecture plan review | `/plan-eng-review` |
| Documentation | `ecc:update-docs` |

If a skill name fails to load, report it as an unresolved mapping instead of substituting an invented command.

## Required Analysis For Types Without A Prompt Doc

- `PERFORMANCE`: measured bottleneck, baseline, hot path, proposed optimization, expected impact, measurement method, regression risks. Never optimize on speculation.
- `INFRASTRUCTURE`: current environment, proposed change, compatibility/deployment impact, secrets/config impact, rollback procedure, required validation. `.github/workflows/deploy.yml` and Docker files are production-critical.
- `DOCUMENTATION`: audience, current gap, source-of-truth code/config, exact documents to update, examples requiring verification.

## Polyglot Note

The repo is TypeScript throughout, but it runs three runtimes: Next.js (`apps/web`), NestJS (`apps/api`), and Drizzle/PostgreSQL migrations (`packages/database`), plus Docker and GitHub Actions. Route and verify for the runtime actually involved.

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
- Backwards Compatibility Risk:
- Template Loaded:
- Context Files Used:
- Next Action:
```

`Backwards Compatibility Risk` values: `None` | `Low` | `Breaking — requires approval`

Set to `Breaking — requires approval` if the change removes, renames, or alters the shape of any public API endpoint, route param, DB column, exported symbol, auth guard, or automation behavior that existing callers depend on.

## Approval Rules

- RCA stops for approval before the bugfix plan.
- Every plan stops for user approval before implementation (`AGENTS.md` node R); Deep plans list their risk-register "Required checks".
- A plan with `Backwards Compatibility Risk: Breaking — requires approval` cannot be approved until the user explicitly grants permission for that breaking change.
- After approval the plan is saved to `docs/plans/<branch-short-name>.md` in the task worktree (`docs/ai/execution.md`).

Plans then satisfy `docs/ai/planning.md` (verification, deterministic spec, completion gate) using `docs/ai/plan-template.md`.

