Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Code Map

- Frontend entry: `apps/web/src/app`
- Backend entry: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Shared DB access: `packages/database/src`
- Shared UI: `packages/ui/src`
- Shared types: `packages/types/src`
- AI docs system: `docs/ai`
- Infra/deploy: `docker-compose.yml`, `docker-compose.prod.yml`, `.github/workflows/deploy.yml`

Main flows:
- auth/session: `apps/web/src/lib/auth*` <-> `apps/api/src/auth/*`
- onboarding: `apps/web/src/app/onboarding` <-> `apps/api/src/onboarding/*`
- appointments: `apps/web/src/app/(dashboard)/appointments` <-> `apps/api/src/appointments/*`
- customers/intake: `apps/web/src/app/intake/[businessId]` + dashboard customer UI <-> `apps/api/src/customers/*`, `apps/api/src/intake/*`
- messaging + AI: `apps/api/src/messaging/*` <-> `apps/api/src/ai/*`
- billing/access: `apps/api/src/billing/*`, `apps/api/src/common/*`, `apps/api/src/platform-admin/*`
- imports: `apps/web/src/app/(dashboard)/imports` <-> `apps/api/src/imports/*`
