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
- Unknown answer -> `UNVERIFIED DEPENDENCY`

## Codex Scratchpad Output

Must include:

- Contract Areas
- Risk Register Notes
- exact files
- exact changes
- verified commands

Write `.ai-scratchpad.md` with `Status: IMPLEMENTATION_READY` only after approval.

