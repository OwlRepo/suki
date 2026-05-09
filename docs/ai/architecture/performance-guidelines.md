Last updated: 2026-05-09T08:25:19.556Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Performance Guidelines

## Frontend (Next.js/React)
- avoid unnecessary rerenders
- memoize only when useful
- avoid oversized client components
- avoid unnecessary global state
- prefer server components where appropriate
- paginate large datasets
- cache expensive operations
- optimize image usage
- avoid request waterfalls

## Backend (NestJS)
- avoid N+1 queries
- validate payloads
- paginate list endpoints
- use indexes for common query paths
- avoid blocking operations
- centralize error handling
