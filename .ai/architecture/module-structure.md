# Module Structure

## Monorepo Boundaries
- `apps/web`: UI routes, components, hooks, client domain flows
- `apps/api`: Nest modules for auth, billing, messaging, crm, customers, imports, automation, security, licensing, etc.
- `packages/database`: migration scripts and database utilities
- `packages/ui`: reusable UI components
- `packages/types`: shared type contracts
- `packages/config`: shared tsconfig presets

## Backend Module Pattern
- `*.module.ts` defines providers/controllers
- `*.controller.ts` handles HTTP contracts
- `*.service.ts` encapsulates domain logic
- guards/filters in `apps/api/src/common` + `apps/api/src/auth`

## Frontend Module Pattern
- `src/app/**` page/layout routes
- `src/components/**` UI/domain components
- `src/hooks/**` reusable behavior hooks
- `src/lib/**` API helpers, utilities, environment behavior
