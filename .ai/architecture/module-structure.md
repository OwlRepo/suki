# Module Structure

## Monorepo Boundaries
- `apps/web`: UI routes, components, hooks, client domain flows
- `apps/api`: Nest modules for auth, billing, messaging, crm, customers, imports, automation, security, licensing, etc.
- `apps/api/src/platform-admin`: internal Tyvera platform-admin authorization and session module under `/platform-admin/*`
- `packages/database`: migration scripts and database utilities
- `packages/ui`: reusable UI components
- `packages/types`: shared type contracts
- `packages/config`: shared tsconfig presets

## Backend Module Pattern
- `*.module.ts` defines providers/controllers
- `*.controller.ts` handles HTTP contracts
- `*.service.ts` encapsulates domain logic
- guards/filters in `apps/api/src/common` + `apps/api/src/auth`
- platform-admin authorization in `apps/api/src/platform-admin`

## Frontend Module Pattern
- `src/app/**` page/layout routes
- `src/components/**` UI/domain components
- `src/components/platform-admin/**` internal console guard, shell, and overview components
- `src/hooks/**` reusable behavior hooks
- `src/lib/**` API helpers, utilities, environment behavior
