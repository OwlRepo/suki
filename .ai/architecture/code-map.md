# Semantic Code Map

## Entry Points
- Web app entry: `apps/web/src/app/layout.tsx` and route tree under `apps/web/src/app`
- API bootstrap: `apps/api/src/main.ts`
- API module root: `apps/api/src/app.module.ts`

## Core Application Flows
- Auth/session: `apps/web/src/lib/clerk.ts` <-> `apps/api/src/auth/*`
- Onboarding: web onboarding pages/components + `apps/api/src/onboarding/*`
- Customers/CRM: dashboard pages + `apps/api/src/customers/*`, `apps/api/src/crm/*`
- Messaging and AI composition: `apps/api/src/messaging/*` + `apps/api/src/ai/*`
- Billing/plans: `apps/api/src/billing/*` + plan guards in `apps/api/src/common`
- Imports: `apps/web/src/app/(dashboard)/imports/page.tsx` + `apps/api/src/imports/*`

## External Integrations
- Clerk auth, PayMongo billing, Twilio, Resend, OpenAI, CRM provider APIs

## Semantic Search Order
1. `.ai/file-index/*`
2. `.ai/architecture/code-map.md`
3. `.ai/architecture/feature-boundaries.md`
4. semantic search (`rg`)
5. direct inspection
