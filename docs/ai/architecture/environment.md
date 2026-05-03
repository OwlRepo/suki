Last updated: 2026-05-03T11:27:01Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Environment Variables

Never print real secret values. Names only.

| Variable | Purpose | Required | Modules |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | Yes | `packages/database`, `apps/api` |
| `OPENAI_API_KEY` | AI generation provider key | Feature-required | `apps/api/src/ai`, `apps/api/src/messaging` |
| `PAYMONGO_SECRET_KEY` | billing API auth | Feature-required | `apps/api/src/billing` |
| `PAYMONGO_WEBHOOK_SECRET` | billing webhook validation | Feature-required | `apps/api/src/billing` |
| `TWILIO_ACCOUNT_SID` | SMS provider account | Feature-required | `apps/api/src/messaging` |
| `TWILIO_AUTH_TOKEN` | SMS provider auth | Feature-required | `apps/api/src/messaging` |
| `TWILIO_MESSAGING_SERVICE_SID` | SMS sender profile | Optional alternative | `apps/api/src/messaging` |
| `TWILIO_PHONE_NUMBER` | SMS sender number | Optional alternative | `apps/api/src/messaging` |
| `TWILIO_STATUS_CALLBACK_URL` | SMS delivery callback | Optional | `apps/api/src/messaging` |
| `RESEND_API_KEY` | email provider auth | Feature-required | `apps/api/src/messaging` |
| `RESEND_FROM_EMAIL` | email sender | Feature-required | `apps/api/src/messaging` |
| `RESEND_WEBHOOK_SECRET` | email webhook validation | Optional | `apps/api/src/messaging` |
| `CLERK_SECRET_KEY` | backend Clerk auth | Auth-required | `apps/api/src/auth` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | frontend Clerk auth | Auth-required | `apps/web/src/app`, `apps/web/src/lib`, `apps/web/src/middleware.ts` |
| `NEXT_PUBLIC_API_URL` | frontend API base URL | Optional | `apps/web/src/lib/api.ts`, intake/settings pages |
| `NEXT_PUBLIC_REQUEST_ACCESS_URL` | marketing/request-access link | Optional | web CTA components |
| `FRONTEND_URL` | API CORS + billing links | Optional | `apps/api/src/main.ts`, billing |
| `PORT` | API listen port | Optional | `apps/api/src/main.ts` |
| `NODE_ENV` | runtime mode | Optional | api/web/common services |
| `ENABLE_DEV_TOOLS` | dev-only billing tooling gate | Optional | `apps/api/src/billing/billing.controller.ts` |
| `PII_ENCRYPTION_KEY_BASE64` | PII encryption key material | Security-required | `apps/api/src/security/pii-crypto.service.ts` |
| `LICENSE_SIGNING_PRIVATE_KEY` | licensing signature key | Feature-required | `apps/api/src/licensing` |
| `OTA_ARTIFACT_BASE_URL` | OTA artifact endpoint | Feature-required | `apps/api/src/licensing/ota-update.service.ts` |
| `OTA_CURRENT_VERSION` | OTA version marker | Optional | `apps/api/src/licensing/ota-update.service.ts` |
| `OCR_API_URL` | OCR provider endpoint | Optional | `apps/api/src/imports/imports.service.ts` |
| `TESSERACT_PATH` | local OCR engine path | Optional | `apps/api/src/imports/imports.service.ts` |
| `GOOGLE_VISION_API_KEY` | OCR provider key | Optional | `apps/api/src/imports/imports.service.ts` |
| `CYPRESS_BASE_URL` | e2e base URL override | Optional | `apps/web/cypress.config.ts` |
| `FF_auto_messaging_enabled` | feature flag | Optional | `apps/api/src/main.ts` |
| `FF_auto_followups_scheduler_enabled` | feature flag | Optional | `apps/api/src/main.ts` |
| `FF_security_audit_enabled` | feature flag | Optional | `apps/api/src/security/audit-log.service.ts` |
| `FF_workspace_global_enabled` | feature flag | Optional | `apps/api/src/common/feature-flags.service.ts` |
| `FF_crm_mode_toggle_enabled` | feature flag | Optional | `apps/api/src/common/feature-flags.service.ts` |
| `FF_ai_usage_transparency_enabled` | feature flag | Optional | `apps/api/src/common/feature-flags.service.ts` |
| `FF_onboarding_v2_enabled` | feature flag | Optional | `apps/api/src/common/feature-flags.service.ts` |
