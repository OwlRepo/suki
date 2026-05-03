Last updated: 2026-05-03T11:29:40.672Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# API Routes

NestJS route handlers are defined by controller files in `apps/api/src/**/*.controller.ts`.

| Domain | Controllers | Primary Consumers | Risk |
|---|---|---|---|
| health | `health.controller.ts` | deploy probes, ops | Medium |
| auth | `auth.controller.ts` | web auth/session sync | High |
| users/org/businesses | `users.controller.ts`, `organizations.controller.ts`, `businesses.controller.ts` | dashboard flows | High |
| customers/intake | `customers.controller.ts`, `intake.controller.ts` | customer workflows | High |
| crm | `activities.controller.ts`, `tasks.controller.ts`, `deals.controller.ts`, `deal-stages.controller.ts`, `custom-fields.controller.ts` | CRM UI pages | High |
| appointments | `appointments.controller.ts` | appointments dashboards | High |
| promos/loyalty/insights | `promos.controller.ts`, `loyalty.controller.ts`, `insights.controller.ts` | growth and analytics pages | High |
| imports | `imports.controller.ts` | import wizard and onboarding | High |
| onboarding/workflows | `onboarding.controller.ts`, `workflows.controller.ts` | setup and automations UI | High |
| messaging | `messaging.controller.ts`, `inbound-sms.controller.ts`, `messaging-webhooks.controller.ts` | outbound/inbound messaging + providers | High |
| billing | `billing.controller.ts`, `billing-webhook.controller.ts` | checkout/billing settings + provider webhooks | High |
| licensing/security | `licensing.controller.ts`, `ota-update.controller.ts`, `privacy.controller.ts` | on-prem licensing/privacy | High |
| admin/ai/automation | `admin.controller.ts`, `ai.controller.ts`, `automation.controller.ts` | admin + AI automations | High |

## Contract Protection Rules
- Identify request/response shapes before edits.
- Identify all web/internal consumers before edits.
- Preserve backward compatibility unless explicit approval for breaking changes.
- Update tests for changed routes and update this doc when controller ownership changes.
