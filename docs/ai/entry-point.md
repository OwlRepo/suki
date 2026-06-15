Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# AI Entry Point

Start here.

1. Read `docs/ai/task-routing.md`. Classify task.
2. Load minimal context with `docs/ai/context-loading.md`.
3. Build deterministic plan with `docs/ai/implementation-playbook.md`.
4. Apply `docs/ai/risk-matrix.md` and `docs/ai/hallucination-prevention.md`.
5. Verify with `docs/ai/verification.md`.

For code change load in this order:
1. `docs/ai/architecture/code-map.md`
2. `docs/ai/architecture/feature-boundaries.md`
3. `docs/ai/file-index/repository-map.md`
4. relevant workflow
5. related tests
6. target files

Task classes:
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

Before edit write:
- WHAT
- WHY
- WHERE
- WHEN
- HOW
- BEFORE/AFTER
- DEPENDENCY IMPACT
- RISK
- TEST PLAN
- BEHAVIOR TEST MATRIX
- CODE FACTS
- ROLLBACK

Before editing file:
- confirm path
- confirm symbol
- inspect nearby code
- inspect imports/exports
- inspect related tests
- inspect consumers if contract moves

High-risk change needs human confirmation:
- auth/authz
- billing/payments
- security/privacy/PII
- schema/migrations
- external-provider webhooks/contracts
- AI policy/rate-limit/concurrency
- CI/CD and deploy config
