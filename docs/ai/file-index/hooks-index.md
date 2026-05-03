Last updated: 2026-05-03T11:29:53.965Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Hooks Index

| Path | Purpose | Main Exports | Dependencies | Consumers | Usage Patterns | Risk |
|---|---|---|---|---|---|---|
| `apps/web/src/hooks/use-auth-sync.ts` | auth/session synchronization | `useAuthSync` | Clerk + API utils | dashboard routes | auth state sync with backend | High |
| `apps/web/src/hooks/use-onboarding-progress.ts` | onboarding progression state | `useOnboardingProgress` | onboarding lib/api | onboarding components | staged onboarding flow control | Medium |
| `apps/web/src/hooks/use-billing-status.ts` | billing status retrieval | `useBillingStatus` | API client | settings/billing pages | subscription state display | High |
| `apps/web/src/hooks/use-feature-flags.ts` | feature-flag reads | `useFeatureFlags` | API/config utils | dashboard pages | runtime UI gating | High |
| `apps/web/src/hooks/use-account-freshness.ts` | account recency checks | `useAccountFreshness` | API/time utils | account-facing components | stale-state refresh handling | Medium |
