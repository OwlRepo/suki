# Routes Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/app/page.tsx` | Public landing route | Uses landing components | Anonymous entry route |
| `apps/web/src/app/(dashboard)/layout.tsx` | Protected dashboard route shell | Wraps dashboard navigation with `RequireSession` | Blocks signed-out dashboard content render and redirects through client/API session state |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Main app dashboard | Uses navigation and metrics components | Authenticated primary route |
| `apps/web/src/app/(dashboard)/customers/page.tsx` | Customer management route | Uses customer modals/list actions | CRM customer workflows |
| `apps/web/src/app/(dashboard)/imports/page.tsx` | Data import route | Calls imports API flow | Batch/mapping import workflows |
| `apps/web/src/app/intake/[businessId]/page.tsx` | Public intake booking route | Uses intake error utils, wizard-progress helper, `api-base`, and shared form/button/date-picker/availability-calendar primitives | External customer intake flow with production `/api` proxy calls, timeline-style wizard steps, month calendar availability, time slot selection, booking review, and OTP verification |
| `apps/web/src/app/(dashboard)/appointments/page.tsx` | Appointments management route | Integrates appointments APIs, customer/status flows, and shared date-picker/availability-calendar primitives | Internal booking operations with month calendar + selected-day agenda, compact date-step availability calendar (available vs unavailable days), cleaner appointment markers, visual new-booking recognition, and direct review-to-create booking flow (no OTP step in dashboard booking wizard) |
| `apps/web/src/app/(dashboard)/share-slots/page.tsx` | Dedicated slot-sharing route | Renders share-slots workflow component and template APIs | Guided flow for composing daily slot visuals, captions, and booking links |
| `apps/web/src/app/sign-in/page.tsx` | Custom first-party sign-in route | Uses `auth-client` password API, session cache invalidation, and router refresh | Email/password sign-in without OTP on login; follows API redirect metadata to `/onboarding` or `/dashboard` |
| `apps/web/src/app/sign-up/page.tsx` | Custom first-party sign-up route | Uses `auth-client` sign-up OTP/password APIs, session cache invalidation, and router refresh | Two-step email/password signup, OTP email verification, and immediate onboarding redirect |
| `apps/web/src/app/onboarding/layout.tsx` | Protected onboarding shell | Wraps onboarding workspace setup with `RequireSession` | Blocks signed-out onboarding content render before auth sync/workspace loading |
| `apps/web/src/app/(dashboard)/help/page.tsx` | Help Center route with unified search and onboarding replay | Uses help-content indexing and shared UI cards/buttons | Client self-serve docs, quick answers, and guided onboarding replay |
| `apps/web/src/app/onboarding-demo/page.tsx` | Sales/client guided onboarding demo route | Reuses onboarding guide modules from help-content | Step-by-step non-destructive walkthrough for demos and re-training |
| `apps/web/src/app/(dashboard)/settings/page.tsx` | Settings route (organization, business, automation, messaging, AI) | Calls organizations/businesses/automation/messaging/AI APIs | Workspace configuration with free-default copy, usage caps, and automation template editing |
| `apps/api/src/customers/customers.controller.ts` | Customer REST endpoints | Delegates to customers services | CRUD + templates + visit actions |
| `apps/api/src/imports/imports.controller.ts` | Import REST endpoints | Delegates to imports/mapping services | Parse/validate/commit pipelines |
| `apps/api/src/billing/billing.controller.ts` | Billing REST endpoints | Uses billing/paymongo services | Plan and add-on management |
| `apps/api/src/messaging/messaging.controller.ts` | Messaging REST endpoints | Uses messaging + AI services | Generate/send usage and metering |
| `apps/api/src/automation/automation.controller.ts` | Automation REST endpoints | Uses automation settings + messaging services | Toggle, preview, template customization, and AI message refinement |
| `apps/api/src/intake/intake.controller.ts` | Public intake + booking REST endpoints | Delegates template and booking hold/OTP logic to intake services | External intake submission, availability lookup, slot holding, and OTP verification |
| `apps/api/src/help/answer-source.controller.ts` | Read-only assistant-ready answer-source endpoints | Uses help answer-source service and auth guard | Source-grounded summaries for business metrics, SMS usage, billing, and AI usage |
| `apps/api/src/help/assistant.controller.ts` | OpenAI-native assistant chat orchestration endpoint | Uses assistant service with auth guard and tenant context | Plain-language assistant responses with action chips and confidence-safe fallbacks |
