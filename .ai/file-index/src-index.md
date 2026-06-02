# Source Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/app/layout.tsx` | Web root layout and providers wiring | Uses `providers.tsx`, shared UI | Entry point for all web routes |
| `apps/web/src/app/(dashboard)/layout.tsx` | Dashboard shell composition | Uses `RequireSession` and navigation components | Shared protected frame for authenticated app pages |
| `apps/web/src/app/onboarding/layout.tsx` | Onboarding shell composition | Uses `RequireSession`, auth sync, workspace provider, and auth button | Shared protected frame for onboarding/setup pages |
| `apps/web/src/proxy.ts` | Next middleware pass-through | Defers auth decisions to client/API session guard and backend API guards | Avoids rejecting API-origin session cookies at the web-origin middleware boundary |
| `apps/api/src/main.ts` | Nest application bootstrap | Loads `AppModule`, global pipe/filter, and auth bootstrap service | API process entry point including optional default-account initialization |
| `apps/api/src/app.module.ts` | Top-level API module composition | Imports domain modules and shared modules | Central dependency wiring |
| `apps/api/src/auth/clerk-auth.guard.ts` | First-party session guard | Used by protected API controllers | Resolves tenant context from `tyvera_session`, temporary legacy `suki_session`, or bearer token |
| `apps/api/src/test/deploy-workflow-governance.spec.ts` | Deploy workflow regression guard | Reads `.github/workflows/deploy.yml` from repo root | Verifies cold rebuild timeout settings, stale dev/prod Compose cleanup without volume deletion, and public web smoke checks for dev artifacts/localhost API URLs |
| `apps/api/src/intake/intake-booking.service.ts` | Intake slot availability, hold, and OTP confirmation logic | Called by intake controller and uses DB schema | Prevents slot conflicts and confirms booking intent via OTP |
| `apps/web/src/components/tyvera-assistant.tsx` | Global floating assistant panel entrypoint for dashboard surfaces | Integrated by adaptive app shell and powered by help-content + AI usage APIs | Guided chat + usage transparency UX for non-technical users |
| `packages/database/src/index.ts` | DB package public exports | Re-exports schema/db helpers | Imported by API services |
