Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Bug Fix Workflow

Use for broken behavior.

Do:
- reproduce bug
- add failing regression test first
- fix with minimum code
- verify happy path and failure path
- update docs index and affected architecture docs
