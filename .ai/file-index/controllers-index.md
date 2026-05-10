# Controllers Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/api/src/auth/auth.controller.ts` | Authentication sync endpoints | Uses `AuthService` | Identity/session synchronization |
| `apps/api/src/customers/customers.controller.ts` | Customer/visit/template endpoints | Uses `CustomersService`, template service, guards | CRM operations |
| `apps/api/src/billing/billing.controller.ts` | Billing and plan endpoints | Uses billing services and auth guard | Subscription and add-on flows |
| `apps/api/src/billing/billing-webhook.controller.ts` | PayMongo webhook ingestion | Uses billing webhook handling service | External payment event processing |
| `apps/api/src/messaging/messaging.controller.ts` | Messaging generation and metering endpoints | Uses messaging + AI execution services | Outbound message workflows |
| `apps/api/src/imports/imports.controller.ts` | Contact import endpoints | Uses import/mapping/migration services | Parse/validate/commit/rollback |
| `apps/api/src/help/answer-source.controller.ts` | Assistant-ready read endpoints for app-scoped answers | Uses `AnswerSourceService` + `ClerkAuthGuard` | Source-only business summary, SMS usage, billing status, AI usage responses |
| `apps/api/src/security/privacy.controller.ts` | Privacy export/correct/anonymize endpoints | Uses security services and owner guard | PII-sensitive operations |
| `apps/api/src/licensing/licensing.controller.ts` | License activation and challenge endpoints | Uses licensing services | Activation and attestation |
