# Refactor Plan

Purpose:

Plan behavior-preserving refactor.

No source edits.

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
8. Codex Scratchpad Output

## Rules

- Prove current behavior from source and tests.
- Verify behavior ownership from source code.
- Do not allow behavior-changing contract drift.
- If public API or invariant risk is unclear, stop and mark `UNVERIFIED DEPENDENCY`.

## Deep Refactor Gate

If refactor touches billing, payments, SMS credits, auth, permissions, automations, jobs, webhooks, migrations, or transactions:

- keep task Deep
- require approval before handoff

## Codex Scratchpad Output

Include Contract Areas when relevant.

Write `.ai-scratchpad.md` with `Status: IMPLEMENTATION_READY` only after approval.

