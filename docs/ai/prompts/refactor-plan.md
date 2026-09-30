# Refactor Plan

Purpose:

Plan behavior-preserving refactor.

No source edits while planning; implementation starts only after approval, in a task worktree.

Forbid broad cleanup.

Forbid opportunistic changes.

## Router Compatibility

- Start with Task Classification block from `docs/ai/task-router.md`.
- Identify affected domain from `docs/ai/module-ownership-map.md`.
- Consult API and DB contract maps for public surface and invariant impact.
- Consult `docs/ai/risk-register.md` for Deep Refactor Gate.
- Mark `CONTEXT DRIFT` if maps are stale.

## Required Sections

1. Refactor Selected
2. Existing Behavior Proof
3. Public API Surface Check
4. Risk Boundaries
5. Implementation Steps
6. Verification & Testing Plan
7. Rollback / Risk Mitigation Plan
8. Plan Output

## Rules

- Prove current behavior from source and tests.
- Verify behavior ownership from source code.
- Do not allow behavior-changing contract drift.
- If public API or invariant risk is unclear, stop and mark `UNVERIFIED DEPENDENCY`.
- Every refactor must pass the Backwards Compatibility Gate before implementation.

## Backwards Compatibility Gate

Run for every refactor plan:

- Does this refactor rename, move, or remove a public API endpoint, route param, response field, DB column, exported function/class/type/constant, auth guard, or automation behavior?
- Are there existing callers inside or outside this repo that depend on the current symbol or contract shape?
- Can the rename/move be done with a re-export shim, alias, or deprecation wrapper so existing callers keep working?
- If a breaking change is unavoidable: label `BREAKING CHANGE`, state what breaks, who is affected, why a shim or alias is not viable, then stop and request explicit user approval before the plan is approved.

Note: a refactor that changes only internal implementation without touching any public surface is non-breaking by definition — confirm this in the Public API Surface Check section.

## Deep Refactor Gate

If refactor touches billing, payments, SMS credits, auth, permissions, automations, jobs, webhooks, migrations, or transactions:

- keep task Deep
- require approval before implementation

## Plan Output

Write the plan with `docs/ai/plan-template.md`. Include Contract Areas when relevant and `Backwards Compatibility: None | Shim/alias added | BREAKING CHANGE — approved by user on [date]`.

Refactors run characterization tests first: they must PASS on the current code, and the PR carries `TDD-Waiver: refactor <reason>` so the CI `tdd:gate` proves they still pass against the base (`docs/ai/testing-strategy.md` "Strict TDD").

The plan stops for user approval; after approval it is committed to `docs/plans/<branch-short-name>.md`. A plan containing an unapproved `BREAKING CHANGE` cannot be approved.
