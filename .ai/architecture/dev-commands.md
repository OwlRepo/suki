# Development Commands

## Root
- `bun run dev`
- `bun run build`
- `bun run test`
- `bun run lint`
- `bun run typecheck`

## Targeted
- `bun run dev:web`
- `bun run dev:api`
- `bun run --cwd apps/web test:run`
- `bun run --cwd apps/api test:run`

## Database
- `bun run db:setup`
- `bun run db:migrate`
- `bun run db:seed`
- `bun run db:seed-platform-admin-rbac`
- `bun run db:bootstrap-platform-admin`
- `bun run db:reset`

## Platform Admin Production Bootstrap
- `bun run db:migrate`
- `bun run db:seed-platform-admin-rbac`
- `PLATFORM_ADMIN_BOOTSTRAP_EMAIL=<existing-login-email> bun run db:bootstrap-platform-admin`

## Docker
- `bun run docker:dev:up`
- `bun run docker:dev:down`
- `bun run docker:prod:up`
