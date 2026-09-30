# Feature Plan

Purpose:

Run feature discovery and implementation plan.

Use Feature Discovery.

Do not use RCA.

No source edits while planning; implementation starts only after approval, in a task worktree.

## Router Compatibility

- Start with Task Classification block from `docs/ai/task-router.md`.
- Consult `docs/ai/module-ownership-map.md` after classification.
- Consult `docs/ai/contracts/api-contracts.md` before API planning.
- Consult `docs/ai/contracts/db-contracts.md` before schema planning.
- Consult `docs/ai/risk-register.md` before final task size.

## Required Sections

1. Feature Selected
2. Existing System Discovery
3. Current Data / Control Flow
4. Feature Gap Analysis
5. API Contract Plan
6. Database & Schema Changes
7. Backend Implementation Steps
8. Frontend Implementation Steps
9. External Integration / Background Job Steps
10. Implementation Sequence
11. Verification & Testing Plan
12. Rollback / Risk Mitigation Plan
13. Plan Output

## Discovery Rules

- Determine whether feature already partially exists.
- Reuse existing patterns only when verified.
- Identify existing or proposed domain.
- Mark missing domain `UNMAPPED DOMAIN`.
- Mark unresolved contract `UNVERIFIED DEPENDENCY`.
- Verify all domain assumptions against source.

## FE-BE Contract Check

Include when feature crosses FE-BE boundary:

- Frontend will send:
- Backend should expect:
- Backend should return:
- Frontend should consume:
- Compatibility risk:
- Backwards compatibility risk: (does this add to, or change/remove the existing contract? If change/remove: is an additive alternative viable?)

## Migration Danger Gate

If schema may change, answer:

- Migration required?
- Backfill required?
- Default/nullability?
- Index or constraint impact?
- Existing data impact?
- Rollback possible?
- Deployment ordering risk?

Unknown answer -> `UNVERIFIED DEPENDENCY`

## Backwards Compatibility Gate

Run for every feature plan regardless of schema changes:

- Does this feature remove or rename an existing public API endpoint, route param, response field, DB column, exported symbol, auth guard, or automation behavior?
- Who are the existing callers or consumers of the affected contract?
- Can the feature be delivered additively (new endpoint alongside old, new optional field, feature flag, versioned route, deprecation warning)?
- If a breaking change is unavoidable: label `BREAKING CHANGE`, state what breaks, who is affected, why additive alternatives are not viable, then stop and request explicit user approval before the plan is approved.

## Plan Output

Write the plan with `docs/ai/plan-template.md` (flow node L). It must include:

- Contract Areas
- Risk Register Notes
- Backwards Compatibility: `None` | `Additive` | `BREAKING CHANGE — approved by user on [date]`
- exact files
- literal old/new changes (or full new-file content)
- verified commands (from `package.json`)
- the RED Test Matrix (`docs/ai/testing-strategy.md` "Strict TDD")

The plan stops for user approval. After approval it is committed to `docs/plans/<branch-short-name>.md` in the task worktree (`docs/ai/execution.md`).

A plan containing an unapproved `BREAKING CHANGE` cannot be approved.
