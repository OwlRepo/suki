# Bugfix RCA

Purpose:

Run bug RCA only.

No implementation.

No source edits.

Do not write `Status: IMPLEMENTATION_READY`.

## Router Compatibility

- Start with Task Classification block from `docs/ai/task-router.md`.
- After classifying intent, consult `docs/ai/module-ownership-map.md`.
- For FE-BE bugs, consult `docs/ai/contracts/api-contracts.md`.
- For schema, model, mutation, billing, credits, jobs, webhooks, or transaction bugs, consult `docs/ai/contracts/db-contracts.md`.
- Consult `docs/ai/risk-register.md` for Deep classification.
- Mark `UNMAPPED DOMAIN`, `UNMAPPED CONTRACT`, `CONTEXT DRIFT`, `CONTRACT DRIFT`, or `CONTRACT MISMATCH` when evidence requires.

## Repository Navigation Rule

Use maps to find likely files.

Verify every claim in source code and tests.

## Required RCA Output

1. Issue Selected
2. Bug Summary
3. Reproduction Flow From Code
4. FE Investigation
5. BE Investigation
6. FE vs BE Contract Check
7. Root Cause
8. Why Existing Code Allows The Bug
9. Eliminated Causes
10. Remaining Uncertainties
11. Confidence Level
12. Basic Solution Direction
13. Planning Handoff

## FE-BE Contract Check

Always include for FE-BE bugs:

- Frontend sends:
- Backend expects:
- Backend returns:
- Frontend expects:
- Mismatch:
- Evidence:

## Task Size

Apply Tiny, Express, Standard, Deep rules from router and risk register.

Deep bugs stop for approval after RCA.

## Planning Handoff

Include:

- Confirmed Root Cause
- Owning Layer
- Primary Affected Files
- Secondary Affected Files
- Confirmed Contract Details
- Files / Causes Ruled Out
- Required Verification Commands
- Planning Constraints

## Evidence Rule

- Quote file paths and symbols.
- Use tested or code-proven facts only.
- Do not include implementation steps.
- Do not write `.ai-scratchpad.md` unless user explicitly asks to store RCA state.

