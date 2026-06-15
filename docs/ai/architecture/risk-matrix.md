Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Architecture Risk Matrix

High-risk zones:
- `apps/api/src/auth`
- `apps/api/src/billing`
- `apps/api/src/security`
- `apps/api/src/ai`
- `packages/database`
- `.github/workflows/*`
- `docker-compose*.yml`

Medium-risk zones:
- shared packages
- route/controller contract files
- onboarding/import flows

Low-risk zones:
- docs
- prompts
- file indexes
- non-behavioral editor config
