# Feature Plan

Purpose:

Run feature discovery and implementation plan.

Use Feature Discovery.

Do not use RCA.

No source edits.

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
13. Codex Scratchpad Output

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

## Codex Scratchpad Output

Must include:

- Contract Areas
- Risk Register Notes
- exact files
- exact changes
- verified commands

Write `.ai-scratchpad.md` with `Status: IMPLEMENTATION_READY` only after approval.

