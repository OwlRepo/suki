# Authentication and Authorization Flow

## Primary Auth System
- First-party auth integrated across web and api.
- Web auth uses `/sign-in` (email/password) and `/sign-up` (email/password plus OTP email verification) pages with first-party session APIs.
- API login uses `POST /auth/sign-in/password` only; public sign-up uses `POST /auth/sign-up/start` to send OTP and `POST /auth/sign-up/verify` with email, code, and password to create the account/session.
- API session cookie canonical name is `tyvera_session`; `suki_session` is accepted and cleared only as a legacy rebrand transition cookie.
- Web middleware in `apps/web/src/proxy.ts` no longer blocks dashboard routes using a web-origin cookie; client guards validate the API-backed session through `/auth/me`.

## API Flow
1. Client sends canonical `tyvera_session`, optional legacy `suki_session`, and/or optional Authorization token.
2. `ClerkAuthGuard` (compatibility name) validates first-party session and resolves principal/tenant context, preferring `tyvera_session` over legacy cookie over bearer token.
3. Domain guards apply additional constraints (billing, owner, crm mode, founder).
4. Controller executes service logic with guarded tenant scope.

## Web Route Protection Flow
1. Request enters Next middleware (`proxy.ts`).
2. Middleware allows routes through so API-origin session cookies are not rejected by a mismatched web-origin check.
3. Dashboard and onboarding shells render `RequireSession`, which calls `useSession()` and redirects signed-out users to `/sign-in` without rendering protected content.
4. Protected API data remains guarded server-side by first-party session validation.
5. Public intake remains available for external booking users without dashboard access.

## Web Auth Stability Notes
- `apps/web/src/lib/auth.tsx` keeps `getToken` referentially stable for effect safety in auth-aware pages/hooks.
- `apps/web/src/hooks/use-session.ts` dedupes `/auth/me` calls across concurrent consumers using module-level cache + in-flight promise, and exposes cache invalidation for login/signup/signout transitions.
- Sign-in/sign-up responses clear legacy `suki_session` while setting `tyvera_session`; sign-out clears both cookie names.
- Protected-route regression coverage includes route-matrix checks (`apps/web/src/proxy.test.ts`) and dashboard bounded-call checks (`apps/web/src/app/(dashboard)/dashboard.loop.test.tsx`).

## Key Modules
- `apps/api/src/auth/*`
- `apps/api/src/common/*guard.ts`
- `apps/web/src/lib/auth.tsx`
- `apps/web/src/components/require-session.tsx`
- `apps/web/src/proxy.ts`
- `apps/web/src/lib/protected-routes.ts`

## Risk
Auth and authorization changes are HIGH risk and require regression tests before implementation and doc/index sync after implementation.
