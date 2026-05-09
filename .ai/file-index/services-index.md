# Services Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/api/src/auth/auth.service.ts` | Auth principal and access logic | Used by `ClerkAuthGuard`, auth controller | Access checks and identity sync |
| `apps/api/src/customers/customers.service.ts` | Customer domain logic | Called by customers controller | Customer CRUD and visit logic |
| `apps/api/src/billing/billing.service.ts` | Billing application logic | Calls PayMongo + plan capacity services | Plan transitions and status |
| `apps/api/src/messaging/messaging.service.ts` | Message generation and dispatch logic | Uses AI execution, providers, metering | Message creation/send orchestration |
| `apps/api/src/ai/ai-execution.service.ts` | Guardrailed AI execution wrapper | Used by messaging and AI module | AI policy-bound text generation |
| `apps/api/src/imports/imports.service.ts` | Import pipeline orchestration | Uses mapping/migration/provider adapters | Batch import processing |
| `apps/api/src/intake/intake-booking.service.ts` | Intake booking and OTP flow | Uses messaging/external providers | Public booking journey backend |
| `apps/api/src/security/pii-crypto.service.ts` | PII encryption/decryption utilities | Used by security/privacy services | Sensitive data protection |
