# Source Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/app/layout.tsx` | Web root layout and providers wiring | Uses `providers.tsx`, shared UI | Entry point for all web routes |
| `apps/web/src/app/(dashboard)/layout.tsx` | Dashboard shell composition | Uses navigation components and workspace context | Shared frame for authenticated app pages |
| `apps/web/src/proxy.ts` | Next middleware auth gate wiring | Uses cookie session presence and `protected-routes` helpers | Enforces public vs protected path behavior at edge/middleware boundary |
| `apps/api/src/main.ts` | Nest application bootstrap | Loads `AppModule`, global pipe/filter, and auth bootstrap service | API process entry point including optional default-account initialization |
| `apps/api/src/app.module.ts` | Top-level API module composition | Imports domain modules and shared modules | Central dependency wiring |
| `apps/api/src/test/deploy-workflow-governance.spec.ts` | Deploy workflow regression guard | Reads `.github/workflows/deploy.yml` from repo root | Verifies production deploy timeout settings allow cold Docker rebuilds |
| `apps/api/src/intake/intake-booking.service.ts` | Intake slot availability, hold, and OTP confirmation logic | Called by intake controller and uses DB schema | Prevents slot conflicts and confirms booking intent via OTP |
| `apps/web/src/components/tyvera-assistant.tsx` | Global floating assistant panel entrypoint for dashboard surfaces | Integrated by adaptive app shell and powered by help-content + AI usage APIs | Guided chat + usage transparency UX for non-technical users |
| `packages/database/src/index.ts` | DB package public exports | Re-exports schema/db helpers | Imported by API services |
