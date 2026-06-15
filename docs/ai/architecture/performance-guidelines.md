Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Performance Guidelines

Web:
- avoid request waterfalls
- keep client components small
- avoid unnecessary rerender work
- paginate large data sets

API:
- avoid N+1 DB queries
- validate payloads early
- paginate list endpoints
- avoid blocking work on request path
