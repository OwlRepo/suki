Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Risk Matrix

Low:
- docs-only
- comments
- formatting
- file-index updates
- non-behavioral config

Medium:
- localized logic change with tests
- non-breaking UI behavior change
- internal refactor with coverage
- prompt/doc system rewrite with no runtime code change

High:
- auth/authz
- billing/payments
- security/privacy/PII
- DB schema/migrations
- external webhook/provider contracts
- AI policy/rate-limit/concurrency
- CI/CD or deploy config

Rules:
- Low -> proceed, verify enough
- Medium -> inspect consumers, run broader verification
- High -> get human confirmation before implementation
