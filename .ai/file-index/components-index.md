# Components Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/components/navigation/adaptive-app-shell.tsx` | Adaptive dashboard shell | Used by dashboard layout/navigation | Responsive app navigation wrapper |
| `apps/web/src/components/dashboard-nav.tsx` | Primary dashboard nav links | Depends on dashboard nav config | Route-level navigation |
| `apps/web/src/components/onboarding/onboarding-wizard.tsx` | Onboarding flow UI | Uses onboarding hooks/services | Progressive onboarding state |
| `apps/web/src/components/customers/customer-form-modal.tsx` | Customer create/edit modal | Calls API via lib/hook layer | CRUD workflow UI |
| `apps/web/src/components/insights/insights-charts.tsx` | Insights chart rendering | Consumes analytics data contracts | Dashboard analytics visualizations |
| `apps/web/src/components/ui/button.tsx` | Shared UI primitive | Used across feature components | Reusable design-system control |
| `packages/ui/src/Button.tsx` | Workspace-level UI button | Shared package for cross-app reuse | Foundation UI component |
