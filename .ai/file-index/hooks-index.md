# Hooks Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/hooks/use-auth-sync.ts` | Sync web auth state with API | Interacts with auth endpoints | Session consistency during app load with in-flight/result dedupe per user id |
| `apps/web/src/hooks/use-onboarding-progress.ts` | Track onboarding completion/progress | Works with onboarding lib/API | Onboarding route and banner logic |
| `apps/web/src/hooks/use-feature-flags.ts` | Fetch and consume feature flags | Tied to health/feature-flags route | Conditional rendering by capability, including `FF_self_serve_billing_enabled` and `FF_annual_billing_checkout_enabled` for billing surfaces |
| `apps/web/src/hooks/use-plan-capabilities.ts` | Derive AI visibility from billing plan state | Wraps billing-status hook and `plan-capabilities` helper | Provides plan-aware booleans for assistant, AI usage, analytics, and refine actions from the current subscription plan |
| `apps/web/src/hooks/use-account-freshness.ts` | Determine account status freshness | Uses profile/workspace signals | Refresh and stale-state handling |
| `apps/web/src/hooks/use-session.ts` | Session state hook for first-party auth | Uses `auth-client` `/auth/me` endpoint | Client-side signed-in checks with module-level `/auth/me` request dedupe/cache and explicit invalidation after login/signup/signout |
