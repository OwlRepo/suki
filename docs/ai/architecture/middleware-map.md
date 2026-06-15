Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Middleware Map

Main guard/filter zone:
- `apps/api/src/common`
- auth-related modules in `apps/api/src/auth`

Inspect before changing route behavior:
- guards
- interceptors
- exception filters
- context/policy helpers
