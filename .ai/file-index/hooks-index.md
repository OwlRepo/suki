# Hooks Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/hooks/use-auth-sync.ts` | Sync web auth state with API | Interacts with auth endpoints | Session consistency during app load |
| `apps/web/src/hooks/use-onboarding-progress.ts` | Track onboarding completion/progress | Works with onboarding lib/API | Onboarding route and banner logic |
| `apps/web/src/hooks/use-billing-status.ts` | Fetch/use billing state | Uses API billing endpoints | Feature gating and banner decisions |
| `apps/web/src/hooks/use-feature-flags.ts` | Fetch and consume feature flags | Tied to health/feature-flags route | Conditional rendering by capability |
| `apps/web/src/hooks/use-account-freshness.ts` | Determine account status freshness | Uses profile/workspace signals | Refresh and stale-state handling |
