# Authentication and Authorization Flow

## Primary Auth System
- Clerk-based auth integrated across web and api.

## API Flow
1. Client sends authorization context.
2. `ClerkAuthGuard` validates and resolves principal/tenant context.
3. Domain guards apply additional constraints (billing, owner, crm mode, founder).
4. Controller executes service logic with guarded tenant scope.

## Key Modules
- `apps/api/src/auth/*`
- `apps/api/src/common/*guard.ts`
- `apps/web/src/lib/clerk.ts`

## Risk
Auth and authorization changes are HIGH risk and require regression tests before implementation.
