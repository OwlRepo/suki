# Controllers Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/api/src/auth/auth.controller.ts` | First-party auth endpoints (`/auth/*`) | Uses `AuthService` and cookie session handling | Password-only sign-in with onboarding/dashboard redirect metadata, public email/password sign-up with OTP verification, enumeration-safe password reset start/verify endpoints, canonical `tyvera_session` cookie issuance, legacy cookie clearing/acceptance, session introspection, and sign-out |
| `apps/api/src/customers/customers.controller.ts` | Customer/visit/template endpoints | Uses `CustomersService`, template service, guards, and shared Philippine mobile validation helpers | CRM operations with optional mobile stored only when blank or valid strict `+639...` E.164 |
| `apps/api/src/billing/billing.controller.ts` | Billing and plan endpoints | Uses billing services and auth guard | Subscription and add-on flows |
| `apps/api/src/billing/billing-webhook.controller.ts` | PayMongo webhook ingestion | Uses billing webhook handling service | External payment event processing |
| `apps/api/src/messaging/messaging.controller.ts` | Messaging generation and metering endpoints | Uses messaging + AI execution services + SMS/email metering services | Outbound message workflows with free-mode usage cap visibility |
| `apps/api/src/messaging/inbound-sms.controller.ts` | Twilio inbound SMS webhook endpoint | Uses `TwilioWebhookValidationService`, customer consent tables, and audit logging | Validates Twilio signatures with the configured public inbound URL, processes STOP opt-outs, and returns empty TwiML |
| `apps/api/src/messaging/messaging-webhooks.controller.ts` | Provider webhook endpoints for messaging delivery events | Uses `TwilioWebhookValidationService` and `MessagingWebhookService` | Validates Twilio status callbacks with the configured public status URL before updating delivery state; also handles Resend Svix webhooks |
| `apps/api/src/automation/automation.controller.ts` | Automation settings and template refinement endpoints | Uses automation settings + messaging services | Per-business automation toggles, template persistence, previews, and AI refinement |
| `apps/api/src/imports/imports.controller.ts` | Contact import endpoints | Uses import/mapping/migration services | Parse/validate/commit/rollback with invalid nonblank mobile rejected before commit |
| `apps/api/src/help/answer-source.controller.ts` | Assistant-ready read endpoints for app-scoped answers | Uses `AnswerSourceService` + `ClerkAuthGuard` | Source-only business summary, SMS usage, billing status, AI usage responses |
| `apps/api/src/help/assistant.controller.ts` | Assistant chat + streaming endpoints for plain-language guided responses | Uses `AssistantService` + tenant auth context | Orchestrates OpenAI-backed answer generation and SSE streaming (`POST /help/assistant/chat`, `POST /help/assistant/chat/stream`) with safe action chips |
| `apps/api/src/security/privacy.controller.ts` | Privacy export/correct/anonymize endpoints | Uses security services and owner guard | PII-sensitive operations |
| `apps/api/src/licensing/licensing.controller.ts` | License activation and challenge endpoints | Uses licensing services | Activation and attestation |
