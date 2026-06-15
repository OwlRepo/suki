Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Database Change Workflow

Use for schema, migration, seed, or DB repair change.

Do:
- inspect `packages/database`
- plan additive path first
- write failing test where practical
- treat as high risk
- update `docs/ai/architecture/schema-map.md`
- update repository map rows touched
