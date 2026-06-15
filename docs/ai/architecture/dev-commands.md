Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Dev Commands

Core:
- `bun install`
- `bun run dev`
- `bun run dev:web`
- `bun run dev:api`
- `bun run build`
- `bun run build:web`
- `bun run build:api`
- `bun run typecheck`
- `bun run lint`
- `bun run test`

DB:
- `bun run db:setup`
- `bun run db:generate`
- `bun run db:migrate`
- `bun run db:seed`
- `bun run db:reset`
- `bun run db:reconcile-orphans`
- `bun run db:studio`

AI docs:
- `bun run update:ai-indexes`
- `bun run check:assistant-context-governance`

Infra:
- `bun run docker:dev:up`
- `bun run docker:dev:build`
- `bun run docker:dev:down`
- `bun run docker:dev:logs`
- `bun run docker:prod:build`
- `bun run docker:prod:up`
- `bun run push:api:acr`
