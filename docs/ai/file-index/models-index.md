Last updated: 2026-05-03T11:27:01Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Models Index

| Path | Purpose | Main Exports | Dependencies | Consumers | Usage Patterns | Risk |
|---|---|---|---|---|---|---|
| `packages/database/src/index.ts` | database package public contract | db exports/types | drizzle/postgres | api/web/scripts | shared persistence contracts | High |
| `packages/database/drizzle.config.ts` | schema generation config | drizzle config object | drizzle-kit + env | db scripts | migration/codegen coordination | High |
| `packages/types/src/index.ts` | shared domain contracts | type exports | TypeScript | api/web/database | compile-time data model alignment | Medium |
