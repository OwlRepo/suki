Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Debugging Workflow

Use when root cause unclear.

Do:
- capture exact symptom
- narrow scope with logs/tests/repro
- prove cause before fix
- if fix changes behavior, return to TDD flow
- update docs only if contract or ownership changed
