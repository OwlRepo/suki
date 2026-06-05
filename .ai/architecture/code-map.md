# Semantic Code Map

## Entry Points
- Web app entry: `apps/web/src/app/layout.tsx` and route tree under `apps/web/src/app`
- API bootstrap: `apps/api/src/main.ts`
- API module root: `apps/api/src/app.module.ts`

## Core Application Flows
- Auth/session: `apps/web/src/lib/auth.tsx` + `apps/web/src/lib/auth-client.ts` <-> `apps/api/src/auth/*`
- Web route protection: `apps/web/src/proxy.ts` + `apps/web/src/lib/protected-routes.ts`
- Onboarding: web onboarding pages/components + `apps/api/src/onboarding/*`
- Appointment-first daily workflow: `apps/web/src/app/(dashboard)/appointments/page.tsx` + `apps/api/src/appointments/*`; staff marks `Arrived`, checked-in visits complete automatically after duration plus grace, and unresolved overdue appointments move to Needs Review.
- Customers/CRM: internal customer records + `apps/api/src/customers/*`, `apps/api/src/crm/*`; customer records remain a retention model and are created/reused during booking rather than a primary dashboard workflow.
- Public intake and booking: `apps/web/src/app/intake/[businessId]/page.tsx` + `apps/api/src/intake/*`
- Messaging and AI composition: `apps/api/src/messaging/*` + `apps/api/src/ai/*`
- Billing/plans: `apps/api/src/billing/*` + plan guards in `apps/api/src/common`
- Imports: `apps/web/src/app/(dashboard)/imports/page.tsx` + `apps/api/src/imports/*`

## External Integrations
- First-party auth + Resend email delivery, Lemon Squeezy billing, Twilio, OpenAI, CRM provider APIs

## Semantic Search Order
1. `.ai/file-index/*`
2. `.ai/architecture/code-map.md`
3. `.ai/architecture/feature-boundaries.md`
4. semantic search (`rg`)
5. direct inspection
