# Utils Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/lib/api.ts` | Web API client helpers | Called by hooks/components | Typed HTTP calls to API |
| `apps/web/src/lib/utils.ts` | Shared client utility functions | Used across UI and feature files | Formatting and helper logic |
| `apps/web/src/lib/protected-routes.ts` | Public/protected pathname policy helpers | Used by route-policy tests and route classification helpers | Centralized public/protected path classification |
| `apps/web/src/app/intake/[businessId]/schedule-utils.ts` | Intake schedule normalization helpers | Used by intake page date/time selection UI | Filters availability days by selected month and formats day labels without timezone drift |
| `apps/web/src/app/intake/[businessId]/error-utils.ts` | Intake error normalization helpers | Used by intake page API submit/OTP flows | Converts variable API error shapes into stable user-facing messages |
| `apps/web/src/lib/dev-mode.ts` | Development mode feature toggles | Works with `dev-store` and UI feedback | Local dev simulations |
| `apps/web/src/lib/share-slots-copy.ts` | Share-slots page copy constants | Consumed by share-slots workflow and tests | Centralizes platform-neutral title/description text for slot-sharing UX |
| `apps/web/src/lib/help-content.ts` | Help Center content contracts, bilingual article data, and search utilities | Reuses onboarding step guidance and feeds help/onboarding-demo routes | Indexed documentation search and guided onboarding replay data source |
| `apps/web/src/lib/assistant-usage.ts` | Assistant usage normalization and plain-language display model helpers | Consumed by assistant UI and usage visualizations | Converts raw AI usage API values into daily-first + monthly secondary remaining/percent/state/reset labels for non-technical users |
| `apps/web/src/lib/auth-client.ts` | First-party auth API client helpers | Consumed by sign-in/sign-up pages and session hook | Cookie-credentialed password sign-in preserving redirect metadata plus sign-up OTP/password calls to `/auth/*` endpoints |
| `apps/web/src/lib/auth.tsx` | Clerk-compatible auth facade for local auth | Replaces direct `@clerk/nextjs` imports in existing UI | Bridges `useAuth`/`SignedIn`/`SignedOut`/`UserButton`; signout invalidates session cache and refreshes router state |
| `apps/api/src/help/assistant.types.ts` | Assistant chat and stream contract types | Shared by assistant controller/service orchestration flow | Defines plain-language answer payload, SSE event union (`meta/state/stage/delta/actions/usage/done/error`), action chip shape, and fallback metadata |
| `apps/api/src/help/assistant-context-loader.ts` | Markdown ingestion and normalization for assistant context | Used by `assistant-context.ts` and governance tests | Parses frontmatter + steps from `docs/assistant-context/**/*.md`, validates schema, and caches loaded entries |
| `apps/api/src/help/assistant-context-governance.ts` | Assistant context governance rule evaluator | Used by governance tests and root script check | Enforces hard-block doc/index/architecture co-update requirements for behavior-impacting FE/BE assistant changes while ignoring non-behavioral files |
| `apps/api/src/common/feature-flags.service.ts` | Feature flag evaluation | Used by health and domain modules | Server-side capability gating |
| `apps/api/src/common/plan-capacity.service.ts` | Plan-based limits and checks | Used by billing/messaging/ai modules | Capacity gating and policy checks |
| `apps/api/src/common/http-exception.filter.ts` | Standard API error response mapping | Registered in `main.ts` | Global error normalization |
| `apps/api/src/messaging/smoke/provider-smoke.preflight.ts` | Real-provider smoke preflight validator for messaging tests | Used by provider smoke specs | Gated Twilio/Resend env readiness checks with deterministic skip diagnostics |
