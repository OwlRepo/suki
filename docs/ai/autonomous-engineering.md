# Autonomous Engineering Orchestration

> Purpose: the contract for running the canonical flow with more autonomy (scheduled or batched work). It adds narrow exceptions to the `AGENTS.md` flow; it never weakens planning, testing, review, QA, handoff, migration, CI, or production gates.
> Status: **PILOT — autonomy Level 2** (`.ai-engineering/config/autonomous-engineering.yaml`). Agents plan, implement, and open PRs; they never merge. No structured task source or scheduler is configured, so every task is manual/ad-hoc and follows the default approval rules in `AGENTS.md` and `docs/ai/handoff.md`.

## Configuration state

| Adapter | State | Evidence |
|---|---|---|
| Runtime | Claude Code (primary); Codex reads `AGENTS.md` via `.codex/instructions.md` | `.claude/`, `.codex/instructions.md` |
| Task source | NOT CONFIGURED — tasks arrive in chat | no task file or tracker integration in the repo |
| Scheduler | NOT CONFIGURED — manual runs only | no scheduled workflow besides `deploy.yml` |
| Notifications | NOT CONFIGURED | — |
| Release | merge to `main` deploys production (`.github/workflows/deploy.yml`) | always a human merge |

Configuring a task source or scheduler is a separate, approved INFRASTRUCTURE task.

## Risk and authorization

The planner assigns risk from task and repository evidence (`docs/ai/risk-register.md`); when evidence cannot prove a lower class, keep the higher one.

- `LOW`: localized, reversible, no shared data/auth/deployment impact.
- `MEDIUM`: multiple components or visible behavior, backward compatible.
- `HIGH`: auth, sensitive data, migrations, shared APIs, billing/credits, jobs/webhooks, deployment config, or broad blast radius.
- `VERY_HIGH`: destructive migration, irreversible production action, security/access/billing authority change, or uncertain rollback.

At Level 2: every plan needs user approval before code; PR creation is autonomous; merge, deploy, and any destructive action always need explicit user instruction. `VERY_HIGH` additionally needs the exact plan version approved.

## Lifecycle

```text
INBOX -> TRIAGED -> PLANNED -> EXECUTING -> PHASE_CHECKPOINT -> REVIEW -> QA
-> PR_READY -> CI_WAIT -> MERGE_READY -> MERGED -> DEPLOYED -> DONE
```

Exceptional states: `NEEDS_INPUT`, `DISCUSS`, `HOLD`, `BLOCKED_HUMAN`, `BLOCKED_EXTERNAL`, `SCOPE_CHANGED`, `CONFLICT_REVIEW`, `FAILED`, `CARRYOVER`, `RELEASE_FROZEN`, `SKIPPED_ALREADY_IMPLEMENTED`. At Level 2 an agent stops at `MERGE_READY`.

## Already-implemented check

Before planning, compare the outcome and every acceptance item against freshly fetched `origin/main` (implementation, usages, tests, routes, types, schema, config, history). If every item is already satisfied, record `SKIPPED_ALREADY_IMPLEMENTED` with the SHA and evidence and create no branch or PR. If only part is satisfied, plan only the gap.

## Concurrency

- One implementation lane for High/Very High, migrations, auth, billing, or shared contracts.
- Two lanes by default for disjoint work; three only for proven-disjoint Low/Medium work.
- Validation, PR integration, and merges are serialized.

## Conflict and repair policy

After every merge, compare active branches with the new `origin/main` across files, symbols, types, APIs, schemas, migrations, config, tests, and business rules. Agents resolve only mechanical conflicts (imports, formatting, non-behavioral docs, additive exports, regenerated files). Behavior, migration, auth, billing, security, tenancy, or API/schema conflicts enter `CONFLICT_REVIEW` and go to the user.

Each failing gate gets at most three evidence-changing fix-and-retest cycles; repeating the same failed action is forbidden. The fourth failure enters `BLOCKED_HUMAN` with the attempts and the recommended next action.

## Release and production gates

No PR is created until all phases and acceptance criteria are complete, review has no unresolved P0/P1/P2 finding, relevant tests pass (pre-existing failures named), docs are synchronized, rollback is documented, and the branch is reconciled with `origin/main`. After a human merge, verify the Deploy run for that SHA (`docs/ai/handoff.md` "Release flow") and run read-only smoke checks only. A failed production verification sets `RELEASE_FROZEN`: evidence preserved, user notified, no further merges until resolved. No autonomous rollback.

## Raising autonomy

Moving to Level 3 (agent merges approved low-risk changes) requires: a completed pilot task reviewed by the user, a configured notification channel, and an explicit user instruction recorded in `.ai-engineering/memory/architecture-decisions.md`. High and Very High gates never relax.
