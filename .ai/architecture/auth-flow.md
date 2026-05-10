# Authentication and Authorization Flow

## Primary Auth System
- First-party auth integrated across web and api.
- Web auth uses `/sign-in` and `/sign-up` pages with API-backed OTP/password session flows.
- Web middleware in `apps/web/src/proxy.ts` applies route-level protection using path policies from `apps/web/src/lib/protected-routes.ts` and session cookie checks.

## API Flow
1. Client sends session cookie and optional Authorization token.
2. `ClerkAuthGuard` (compatibility name) validates first-party session and resolves principal/tenant context.
3. Domain guards apply additional constraints (billing, owner, crm mode, founder).
4. Controller executes service logic with guarded tenant scope.

## Web Route Protection Flow
1. Request enters Next middleware (`proxy.ts`).
2. Public paths (`/`, `/sign-in`, `/sign-up`, `/intake/*`) bypass auth protection.
3. Protected dashboard/business paths require auth when session cookie exists and resolves.
4. Public intake remains available for external booking users without dashboard access.

## Web Auth Stability Notes
- `apps/web/src/lib/auth.tsx` keeps `getToken` referentially stable for effect safety in auth-aware pages/hooks.
- `apps/web/src/hooks/use-session.ts` dedupes `/auth/me` calls across concurrent consumers using module-level cache + in-flight promise.
- Protected-route regression coverage includes route-matrix checks (`apps/web/src/proxy.test.ts`) and dashboard bounded-call checks (`apps/web/src/app/(dashboard)/dashboard.loop.test.tsx`).

## Key Modules
- `apps/api/src/auth/*`
- `apps/api/src/common/*guard.ts`
- `apps/web/src/lib/auth.tsx`
- `apps/web/src/proxy.ts`
- `apps/web/src/lib/protected-routes.ts`

## Risk
Auth and authorization changes are HIGH risk and require regression tests before implementation and doc/index sync after implementation.
