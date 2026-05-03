Last updated: 2026-05-03T12:46:06.000Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Controllers Index

| File Path | Purpose | Main Exports | Dependencies | Consumers | Usage Patterns | Risk |
|---|---|---|---|---|---|---|
| `apps/api/src/auth/auth.controller.ts` | auth endpoints | `AuthController` | auth service, guards | web auth flows | login/session sync | High |
| `apps/api/src/billing/billing.controller.ts` | checkout and billing actions | `BillingController` | billing/paymongo services | settings/billing UI | manual billing status, plan change, SMS add-on flows | High |
| `apps/api/src/billing/billing-webhook.controller.ts` | provider webhook ingress | `BillingWebhookController` | webhook validation + billing service | PayMongo callbacks | signed webhook processing | High |
| `apps/api/src/messaging/messaging.controller.ts` | outbound message endpoints | `MessagingController` | messaging service | dashboard messaging flows | AI-assisted + manual messaging | High |
| `apps/api/src/messaging/messaging-webhooks.controller.ts` | inbound webhook endpoints | `MessagingWebhooksController` | webhook service | Twilio/Resend callbacks | provider event ingestion | High |
| `apps/api/src/crm/*.controller.ts` | CRM resources (code present, module disabled in MVP wiring) | controller classes | CRM services | none in active MVP routing | dormant CRUD and pipeline management | Medium |
| `apps/api/src/customers/customers.controller.ts` | customer records | `CustomersController` | customer services | customers page | customer CRUD/history | High |
| `apps/api/src/imports/imports.controller.ts` | import workflows | `ImportsController` | import/mapping services | imports page | upload/mapping/apply | High |
| `apps/api/src/licensing/*.controller.ts` | licensing + OTA endpoints (code present, module disabled in MVP wiring) | controller classes | licensing services | none in active MVP routing | dormant license verify/update checks | Medium |
| `apps/api/src/insights/insights.controller.ts` | insights endpoints | `InsightsController` | insights service | insights page | analytics aggregation | High |
| `apps/api/src/health/health.controller.ts` | health checks | `HealthController` | lightweight services | CI/deploy probes | readiness/liveness | Medium |
