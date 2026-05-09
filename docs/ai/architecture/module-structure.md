Last updated: 2026-05-09T08:25:19.556Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Module Structure

- `apps/web/src`: app router pages, UI screens, hooks, client/server features
- `apps/api/src`: domain modules with controller/service/module patterns
- `packages/database`: schema + scripts (`setup`, `migrate`, `seed`, reset)
- `packages/ui`: shared UI components
- `packages/types`: shared TypeScript contracts
