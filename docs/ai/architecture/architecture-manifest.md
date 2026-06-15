Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Architecture Manifest

Repo shape:
- monorepo with Bun + Turborepo
- `apps/web` = Next.js frontend
- `apps/api` = NestJS backend
- `packages/database` = Drizzle + PostgreSQL contracts and scripts
- `packages/ui`, `packages/types`, `packages/config` = shared packages

Runtime rules:
- web consumes API/contracts, not provider SDKs
- API owns domain logic, validation, integrations
- DB package owns schema and migration paths
- shared packages stay backward-compatible across apps

Infra:
- Docker compose for dev/prod
- GitHub Actions deploy workflow
- `docs/ai/*` is canonical AI system
