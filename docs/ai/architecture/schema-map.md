Last updated: 2026-05-03T11:29:25.639Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Schema Map

Database ownership is centralized in `packages/database`.

| Area | Path | Notes | Risk |
|---|---|---|---|
| Drizzle config | `packages/database/drizzle.config.ts` | connection + output config | High |
| DB client/bootstrap | `packages/database/src/database.ts` | runtime database URL resolution | High |
| DB package exports | `packages/database/src/index.ts` | shared DB API surface | High |
| setup script | `packages/database/scripts/setup.ts` | local DB preparation | High |
| migrate script | `packages/database/scripts/migrate.ts` | migration execution | High |
| seed script | `packages/database/scripts/seed.ts` | seed data operations | High |
| reset script | `packages/database/scripts/reset.ts` | destructive reset path | High |
| reconcile script | `packages/database/scripts/reconcile-orphans.ts` | data repair utility | High |

## Database Safety Rules
- Never run production migrations from local assistant workflows.
- Review downstream API/web consumers before changing schema contracts.
- Prefer additive changes and staged migrations.
