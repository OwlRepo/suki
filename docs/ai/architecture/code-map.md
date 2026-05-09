Last updated: 2026-05-09T08:25:19.556Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Code Map

- Frontend entry: `apps/web/src/app`
- Backend entry: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Shared DB access: `packages/database`
- Shared UI: `packages/ui/src`
- Shared types: `packages/types/src`
- Infra/deploy: `docker-compose.yml`, `docker-compose.prod.yml`, `.github/workflows/deploy.yml`
