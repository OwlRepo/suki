Last updated: 2026-05-09T12:07:06.828Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# External Services

| Service | Integration Area | Key Files |
|---|---|---|
| Clerk | web/auth/api auth | `apps/web/src/lib/clerk.ts`, `apps/api/src/auth/auth.service.ts` |
| OpenAI | AI generation and messaging | `apps/api/src/ai/ai-execution.service.ts`, `apps/api/src/messaging/messaging.service.ts` |
| PayMongo | billing checkout + webhook | `apps/api/src/billing/paymongo.service.ts`, `apps/api/src/billing/billing-webhook.controller.ts` |
| Twilio | SMS send + webhook | `apps/api/src/messaging/providers/twilio-sms.provider.ts`, `apps/api/src/messaging/messaging-webhook.service.ts` |
| Resend | Email send + webhook | `apps/api/src/messaging/providers/resend-email.provider.ts`, `apps/api/src/messaging/messaging-webhook.service.ts` |
| Svix | dependency present in root package | source usage not detected |
| PostgreSQL | persistence | `packages/database/src/database.ts` |

## Ownership Notes
- External-provider contracts are owned by API modules, not web components.
- Web should consume backend APIs, not provider SDKs directly.
