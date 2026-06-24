# Bugfix Plan

Purpose:

Turn approved RCA into implementation plan.

No source edits.

Do not write implementation handoff when contract details are unresolved.

## Preconditions

- Approved RCA exists.
- Carry forward Task Classification from RCA.
- Reuse verified RCA facts.
- Re-check contracts in source before final handoff.

## Required Sections

1. Plan Overview & Scope
2. Database & Schema Changes
3. Backend Implementation Steps
4. Frontend Implementation Steps
5. Implementation Verification & Testing Plan
6. Rollback / Risk Mitigation Plan
7. Codex Scratchpad Output

## Rules

- Every step must map to verified RCA facts.
- Every step must map to verified contracts.
- Include FE-BE Contract Check:
  Frontend sends / Backend expects / Backend returns / Frontend expects / Contract change / Compatibility risk
- Run Migration Danger Gate when schema might change:
  Migration required / Backfill required / Default-nullability / Index or constraint impact / Existing data impact / Rollback possible / Deployment ordering risk
- Run Backwards Compatibility Gate for every plan:
  Does fix remove or rename a public endpoint, route param, DB column, exported symbol, auth guard, or automation behavior? / Who are the existing callers or dependents? / Can the fix be applied additively (new field alongside old, versioned endpoint, feature flag, deprecation shim)? / If breaking is unavoidable: label `BREAKING CHANGE`, explain what breaks, who is affected, and why non-breaking alternatives are not viable, then stop and request explicit user approval before writing scratchpad.
- Unknown answer -> `UNVERIFIED DEPENDENCY`

## Codex Scratchpad Output

Must include:

- Contract Areas
- Risk Register Notes
- Backwards Compatibility: `None` | `Low` | `BREAKING CHANGE — approved by user on [date]`
- exact files
- exact changes
- verified commands

Write `.ai-scratchpad.md` with `Status: IMPLEMENTATION_READY` only after approval.

Do not write `Status: IMPLEMENTATION_READY` if plan contains an unapproved `BREAKING CHANGE`.

