# Authentication and Authorization Flow

## Primary Auth System
- Clerk-based auth integrated across web and api.
- Web middleware in `apps/web/src/proxy.ts` applies route-level protection using path policies from `apps/web/src/lib/protected-routes.ts`.

## API Flow
1. Client sends authorization context.
2. `ClerkAuthGuard` validates and resolves principal/tenant context.
3. Domain guards apply additional constraints (billing, owner, crm mode, founder).
4. Controller executes service logic with guarded tenant scope.

## Web Route Protection Flow
1. Request enters Next middleware (`proxy.ts`).
2. Public paths (`/`, `/sign-in`, `/sign-up`, `/intake/*`) bypass auth protection.
3. Protected dashboard/business paths require auth when Clerk is configured.
4. Public intake remains available for external booking users without dashboard access.

## Key Modules
- `apps/api/src/auth/*`
- `apps/api/src/common/*guard.ts`
- `apps/web/src/lib/clerk.ts`
- `apps/web/src/proxy.ts`
- `apps/web/src/lib/protected-routes.ts`

## Risk
Auth and authorization changes are HIGH risk and require regression tests before implementation.
