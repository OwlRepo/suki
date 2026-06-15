Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Refactor Workflow

Use for structure change with same behavior.

Do:
- find existing coverage first
- add safety tests if coverage weak
- move code after behavior locked
- keep diff scoped
- update docs index if file roles moved
