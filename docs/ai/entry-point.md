Last updated: 2026-05-03T11:27:01Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# AI Entry Point

## Start Here
1. Read `docs/ai/task-routing.md` and classify task type.
2. Load context minimally using `docs/ai/context-loading.md`.
3. Build deterministic plan using `docs/ai/implementation-playbook.md`.
4. Apply safety checks from `docs/ai/risk-matrix.md` and `docs/ai/hallucination-prevention.md`.
5. Verify with `docs/ai/verification.md`.

## Semantic Search Protocol
1. `docs/ai/file-index`
2. `docs/ai/architecture/code-map.md`
3. `docs/ai/architecture/feature-boundaries.md`
4. semantic repo search
5. direct file inspection

## Task Classes
- Bug Fix
- Feature Implementation
- Enhancement
- Refactor
- Code Review
- Debugging
- API Change
- Database Change
- Dependency Upgrade
- Documentation Update

See: `docs/ai/task-routing.md`.

## Deterministic Plan Required Before Edits
Document:
- WHAT
- WHY
- WHERE
- WHEN
- HOW
- BEFORE/AFTER (if useful)
- DEPENDENCY IMPACT
- RISK LEVEL (LOW/MEDIUM/HIGH)
- TEST PLAN
- ROLLBACK

## File Anchor Verification
Before editing any file:
- confirm path exists
- identify exact symbol to modify
- inspect nearby code
- verify imports/exports
- check related tests
- check consumers if public API is affected

## High-Risk Gate
Explicit user confirmation is required before implementation for changes affecting:
- auth/authz (`apps/api/src/auth`, guards in `apps/api/src/common`)
- billing/payments (`apps/api/src/billing`)
- security/privacy/PII (`apps/api/src/security`)
- schema/migrations (`packages/database`)
- external-provider webhooks/contracts (messaging, billing, licensing)
- AI policy/rate-limit/concurrency (`apps/api/src/ai`)
- CI/CD and deploy config (`.github/workflows`, `docker-compose*.yml`)
