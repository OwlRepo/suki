Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Schema Map

DB ownership stays in `packages/database`.

Key paths:
- `packages/database/drizzle.config.ts`
- `packages/database/src/database.ts`
- `packages/database/src/index.ts`
- `packages/database/src/schema`
- `packages/database/scripts/setup.ts`
- `packages/database/scripts/migrate.ts`
- `packages/database/scripts/seed.ts`
- `packages/database/scripts/reset.ts`
- `packages/database/scripts/reconcile-orphans.ts`

Rules:
- never run production migration from assistant workflow
- prefer additive schema change
- inspect downstream API/web consumers before contract move
