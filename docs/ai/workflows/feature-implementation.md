Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Feature Implementation Workflow

Use for net-new behavior.

Do:
- confirm boundary owner
- write failing test for expected behavior
- implement minimum slice
- verify contract, edge path, failure path
- update docs index and affected architecture docs
