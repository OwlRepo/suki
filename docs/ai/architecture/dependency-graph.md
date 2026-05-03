Last updated: 2026-05-03T11:29:25.639Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Dependency Graph

- `apps/web` -> `@suki/ui`, `@suki/types`, `@suki/database` (package dependency present)
- `apps/api` -> `@suki/types`, `@suki/database`
- `packages/database` -> PostgreSQL + Drizzle
- `packages/ui` -> React-based shared components

## Policy: `apps/web -> @suki/database`
- Allowed only for shared contracts/helpers that do not require server-only DB execution in browser runtime.
- New direct data-access usage from web UI is restricted; prefer API-mediated access.
- Treat this dependency as transitional unless explicitly approved for a concrete use case.
