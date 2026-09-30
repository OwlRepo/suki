# Bugfix Plan

Purpose:

Turn approved RCA into implementation plan.

No source edits while planning; implementation starts only after approval, in a task worktree.

Do not write an implementation plan when contract details are unresolved.

## Preconditions

- Approved RCA exists.
- Carry forward Task Classification from RCA.
- Reuse verified RCA facts.
- Re-check contracts in source before the plan is submitted for approval.

## Required Sections

1. Plan Overview & Scope
2. Database & Schema Changes
3. Backend Implementation Steps
4. Frontend Implementation Steps
5. Implementation Verification & Testing Plan
6. Rollback / Risk Mitigation Plan
7. Plan Output

## Rules

- Every step must map to verified RCA facts.
- Every step must map to verified contracts.
- Include FE-BE Contract Check:
  Frontend sends / Backend expects / Backend returns / Frontend expects / Contract change / Compatibility risk
- Run Migration Danger Gate when schema might change:
  Migration required / Backfill required / Default-nullability / Index or constraint impact / Existing data impact / Rollback possible / Deployment ordering risk
- Run Backwards Compatibility Gate for every plan:
  Does fix remove or rename a public endpoint, route param, DB column, exported symbol, auth guard, or automation behavior? / Who are the existing callers or dependents? / Can the fix be applied additively (new field alongside old, versioned endpoint, feature flag, deprecation shim)? / If breaking is unavoidable: label `BREAKING CHANGE`, explain what breaks, who is affected, and why non-breaking alternatives are not viable, then stop and request explicit user approval before the plan is approved.
- Unknown answer -> `UNVERIFIED DEPENDENCY`

## Plan Output

Write the plan with `docs/ai/plan-template.md` (flow node L). It must include:

- Contract Areas
- Risk Register Notes
- Backwards Compatibility: `None` | `Low` | `BREAKING CHANGE — approved by user on [date]`
- exact files
- literal old/new changes (or full new-file content)
- verified commands (from `package.json`)
- the RED Test Matrix (`docs/ai/testing-strategy.md` "Strict TDD")

The plan stops for user approval. After approval it is committed to `docs/plans/<branch-short-name>.md` in the task worktree (`docs/ai/execution.md`).

A plan containing an unapproved `BREAKING CHANGE` cannot be approved.
