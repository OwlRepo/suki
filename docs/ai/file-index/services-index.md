Last updated: 2026-05-09T08:25:19.556Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Services Index

| File Path | Purpose | Main Exports | Dependencies | Consumers | Usage Patterns | Risk |
|---|---|---|---|---|---|---|
| `apps/api/src/auth/auth.service.ts` | auth identity and user sync | `AuthService` | Clerk backend, DB | auth controller/guards | user provisioning and auth checks | High |
| `apps/api/src/billing/billing.service.ts` | subscription/business billing compatibility storage | `BillingService` | DB | billing controllers | legacy subscription read/write support while free mode disables checkout | High |
| `apps/api/src/billing/paymongo.service.ts` | provider API client | `PaymongoService` | external HTTP, env secrets | billing service/controller | checkout/webhook support | High |
| `apps/api/src/messaging/messaging.service.ts` | compose/send messaging | `MessagingService` | providers + AI + DB | messaging controllers | send flows and status handling | High |
| `apps/api/src/messaging/messaging-webhook.service.ts` | provider webhook verification | `MessagingWebhookService` | Twilio/Resend signatures | webhooks controller | inbound event validation | High |
| `apps/api/src/ai/*.service.ts` | AI policy/execution controls | service classes | OpenAI + quotas | AI/messaging modules | request limits, concurrency, execution | High |
| `apps/api/src/imports/*.service.ts` | import parsing/mapping/migration | service classes | csv/xlsx/ocr, DB | imports controller | migration/import pipelines | High |
| `apps/api/src/licensing/*.service.ts` | license and OTA logic (code present, module disabled in MVP wiring) | service classes | signing keys/artifacts | none in active MVP wiring | dormant entitlement and update validation | Medium |
| `apps/api/src/security/*.service.ts` | privacy and audit controls | service classes | crypto + flags | privacy/security modules | encryption and audit events | High |
| `apps/api/src/common/*.service.ts` | shared policy and feature flags | service classes | env + helpers | many API modules | feature flags, org state, free-mode access policies | High |
