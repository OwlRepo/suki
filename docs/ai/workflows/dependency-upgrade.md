Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Dependency Upgrade Workflow

Use for package version change.

Do:
- get human approval first
- inspect changelog and break risk
- write or update regression coverage around touched behavior
- verify install, typecheck, lint, tests, build
- update docs if commands or contracts moved
