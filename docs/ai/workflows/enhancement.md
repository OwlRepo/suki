Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Enhancement Workflow

Use for improving existing behavior without full new feature.

Do:
- define before and after
- write failing test first
- preserve stable public contract unless approved
- verify nearby flows did not regress
- update docs index and affected architecture docs
