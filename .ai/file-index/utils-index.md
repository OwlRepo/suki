# Utils Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/lib/api.ts` | Web API client helpers | Called by hooks/components | Typed HTTP calls to API |
| `apps/web/src/lib/utils.ts` | Shared client utility functions | Used across UI and feature files | Formatting and helper logic |
| `apps/web/src/lib/protected-routes.ts` | Public/protected pathname policy helpers | Used by Next middleware route matcher | Centralized route access classification for auth gating |
| `apps/web/src/app/intake/[businessId]/schedule-utils.ts` | Intake schedule normalization helpers | Used by intake page date/time selection UI | Filters availability days by selected month and formats day labels without timezone drift |
| `apps/web/src/app/intake/[businessId]/error-utils.ts` | Intake error normalization helpers | Used by intake page API submit/OTP flows | Converts variable API error shapes into stable user-facing messages |
| `apps/web/src/lib/dev-mode.ts` | Development mode feature toggles | Works with `dev-store` and UI feedback | Local dev simulations |
| `apps/web/src/lib/share-slots-copy.ts` | Share-slots page copy constants | Consumed by share-slots workflow and tests | Centralizes platform-neutral title/description text for slot-sharing UX |
| `apps/api/src/common/feature-flags.service.ts` | Feature flag evaluation | Used by health and domain modules | Server-side capability gating |
| `apps/api/src/common/plan-capacity.service.ts` | Plan-based limits and checks | Used by billing/messaging/ai modules | Capacity gating and policy checks |
| `apps/api/src/common/http-exception.filter.ts` | Standard API error response mapping | Registered in `main.ts` | Global error normalization |
