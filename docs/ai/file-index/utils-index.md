Last updated: 2026-05-03T11:29:40.672Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Utils Index

| Path | Purpose | Main Exports | Dependencies | Consumers | Usage Patterns | Risk |
|---|---|---|---|---|---|---|
| `apps/web/src/lib/api.ts` | frontend API client helpers | request helpers | fetch + env | hooks/pages/components | API base URL and request plumbing | High |
| `apps/web/src/lib/clerk.ts` | Clerk config guards | auth helpers | env + Clerk | providers/routes | auth configuration checks | High |
| `apps/web/src/lib/onboarding.ts` | onboarding domain helpers | onboarding helpers | app types/utils | onboarding UI | setup state derivation | Medium |
| `apps/web/src/lib/dev-mode.ts` | dev-mode toggles | dev helper exports | env | components/pages | development-only behavior flags | Low |
| `apps/api/src/common/*.guard.ts` | authorization and policy guards | guard classes | Nest auth/context | controllers | route-level access control | High |
| `apps/api/src/common/http-exception.filter.ts` | API exception shaping | filter class | Nest exceptions | global app config | centralized error serialization | High |
| `packages/database/src/database.ts` | DB bootstrap utility | db instance helpers | postgres/drizzle | API services/scripts | DB connection lifecycle | High |
