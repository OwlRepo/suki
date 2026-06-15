Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Code Review Workflow

Use for findings-first review.

Check:
- behavior bug
- regression risk
- contract break
- missing test
- security or performance risk

Output:
- findings first
- exact file path
- exact reason
- concise fix direction
