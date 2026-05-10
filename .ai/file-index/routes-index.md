# Routes Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/app/page.tsx` | Public landing route | Uses landing components | Anonymous entry route |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Main app dashboard | Uses navigation and metrics components | Authenticated primary route |
| `apps/web/src/app/(dashboard)/customers/page.tsx` | Customer management route | Uses customer modals/list actions | CRM customer workflows |
| `apps/web/src/app/(dashboard)/imports/page.tsx` | Data import route | Calls imports API flow | Batch/mapping import workflows |
| `apps/web/src/app/intake/[businessId]/page.tsx` | Public intake booking route | Uses intake error utils, wizard-progress helper, and shared form/button primitives | External customer intake flow with timeline-style wizard steps, staged date/time selection, booking preview review step, and OTP verification |
| `apps/web/src/app/(dashboard)/appointments/page.tsx` | Appointments management route | Integrates appointments APIs and customer/status flows | Internal booking operations for creating, updating, and tracking appointment status |
| `apps/web/src/app/(dashboard)/share-slots/page.tsx` | Dedicated slot-sharing route | Renders share-slots workflow component and template APIs | Guided flow for composing daily slot visuals, captions, and booking links |
| `apps/web/src/app/(dashboard)/help/page.tsx` | Help Center route with unified search and onboarding replay | Uses help-content indexing and shared UI cards/buttons | Client self-serve docs, quick answers, and guided onboarding replay |
| `apps/web/src/app/onboarding-demo/page.tsx` | Sales/client guided onboarding demo route | Reuses onboarding guide modules from help-content | Step-by-step non-destructive walkthrough for demos and re-training |
| `apps/api/src/customers/customers.controller.ts` | Customer REST endpoints | Delegates to customers services | CRUD + templates + visit actions |
| `apps/api/src/imports/imports.controller.ts` | Import REST endpoints | Delegates to imports/mapping services | Parse/validate/commit pipelines |
| `apps/api/src/billing/billing.controller.ts` | Billing REST endpoints | Uses billing/paymongo services | Plan and add-on management |
| `apps/api/src/messaging/messaging.controller.ts` | Messaging REST endpoints | Uses messaging + AI services | Generate/send usage and metering |
| `apps/api/src/intake/intake.controller.ts` | Public intake + booking REST endpoints | Delegates template and booking hold/OTP logic to intake services | External intake submission, availability lookup, slot holding, and OTP verification |
| `apps/api/src/help/answer-source.controller.ts` | Read-only assistant-ready answer-source endpoints | Uses help answer-source service and auth guard | Source-grounded summaries for business metrics, SMS usage, billing, and AI usage |
