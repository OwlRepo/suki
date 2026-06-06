# Authentication and Authorization Flow

## Primary Auth System
- First-party auth integrated across web and api.
- Web auth uses `/sign-in` (email/password), `/forgot-password` (email OTP password reset), and `/sign-up` (email/password plus OTP email verification) pages with first-party session APIs.
- API login uses `POST /auth/sign-in/password` only and returns post-login redirect metadata based on onboarding completion; public sign-up uses `POST /auth/sign-up/start` to send OTP and `POST /auth/sign-up/verify` with email, code, and password to create the account/session; password reset uses `POST /auth/password-reset/start` + `POST /auth/password-reset/verify`.
- API session cookie name is `tyvera_session`.
- Web middleware in `apps/web/src/proxy.ts` no longer blocks dashboard routes using a web-origin cookie; client guards validate the API-backed session through `/auth/me`.

## API Flow
1. Client sends `tyvera_session` and/or optional Authorization token.
2. `ClerkAuthGuard` (compatibility name) validates first-party session and resolves principal/tenant context, preferring `tyvera_session` over bearer token. Tenant context includes `clerkId` so founder allowlist user IDs continue to work during bootstrap.
3. Domain guards apply additional constraints (billing, owner, crm mode, founder, platform-admin RBAC).
4. Controller executes service logic with guarded tenant scope.

## Web Route Protection Flow
1. Request enters Next middleware (`proxy.ts`).
2. Middleware allows routes through so API-origin session cookies are not rejected by a mismatched web-origin check.
3. Dashboard and onboarding shells render `RequireSession`, which calls `useSession()` and redirects signed-out users to `/sign-in` without rendering protected content.
4. Platform-admin pages render `RequireSession` and then `RequirePlatformAdmin`, which calls `/platform-admin/session`, redirects unauthenticated users to `/sign-in`, and redirects authenticated non-platform users to `/dashboard`.
5. Protected API data remains guarded server-side by first-party session validation and route-specific guards.
6. Public intake remains available for external booking users without dashboard access.

## Web Auth Stability Notes
- `apps/web/src/lib/auth.tsx` keeps `getToken` referentially stable for effect safety in auth-aware pages/hooks.
- `apps/web/src/hooks/use-session.ts` dedupes `/auth/me` calls across concurrent consumers using module-level cache + in-flight promise, and exposes cache invalidation for login/signup/signout transitions.
- Sign-in/sign-up/password-reset verify responses set `tyvera_session`; sign-out clears that cookie.
- Successful sign-up routes users to `/onboarding`; successful password sign-in routes to `/onboarding` when user-specific onboarding progress is missing or incomplete (`currentStep < 7`), otherwise to `/dashboard`.
- Password reset starts are enumeration-safe and return success even when no account exists; successful reset verifies an email OTP, replaces the stored password hash, revokes old sessions, creates a fresh session, and redirects using the same onboarding/dashboard metadata as password sign-in.
- Protected-route regression coverage includes route-matrix checks (`apps/web/src/proxy.test.ts`) and dashboard bounded-call checks (`apps/web/src/app/(dashboard)/dashboard.loop.test.tsx`).

## Key Modules
- `apps/api/src/auth/*`
- `apps/api/src/common/*guard.ts`
- `apps/api/src/platform-admin/*`
- `apps/web/src/lib/auth.tsx`
- `apps/web/src/components/require-session.tsx`
- `apps/web/src/components/platform-admin/require-platform-admin.tsx`
- `apps/web/src/proxy.ts`
- `apps/web/src/lib/protected-routes.ts`

## Risk
Auth and authorization changes are HIGH risk and require regression tests before implementation and doc/index sync after implementation.
