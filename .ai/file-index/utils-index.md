# Utils Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/lib/api.ts` | Web API client helpers | Called by hooks/components | Typed HTTP calls to API |
| `apps/web/src/lib/utils.ts` | Shared client utility functions | Used across UI and feature files | Formatting and helper logic |
| `apps/web/src/app/intake/[businessId]/schedule-utils.ts` | Intake schedule normalization helpers | Used by intake page date/time selection UI | Filters availability days by selected month and formats day labels without timezone drift |
| `apps/web/src/lib/dev-mode.ts` | Development mode feature toggles | Works with `dev-store` and UI feedback | Local dev simulations |
| `apps/api/src/common/feature-flags.service.ts` | Feature flag evaluation | Used by health and domain modules | Server-side capability gating |
| `apps/api/src/common/plan-capacity.service.ts` | Plan-based limits and checks | Used by billing/messaging/ai modules | Capacity gating and policy checks |
| `apps/api/src/common/http-exception.filter.ts` | Standard API error response mapping | Registered in `main.ts` | Global error normalization |
