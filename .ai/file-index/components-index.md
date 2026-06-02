# Components Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/components/navigation/adaptive-app-shell.tsx` | Adaptive dashboard shell | Used by dashboard layout/navigation | Responsive app navigation wrapper |
| `apps/web/src/components/navigation/dashboard-nav-config.ts` | Dashboard navigation source config | Consumed by desktop/mobile navigation components | Defines grouped sidebar links and mobile bottom-nav priorities |
| `apps/web/src/components/share-slots/share-slots-workflow.tsx` | Share-slots workflow surface | Uses workspace context, auth hooks, and appointments share-template APIs | Step-by-step slot sharing flow with template management, asset generation, and copy actions |
| `apps/web/src/components/ai-quota-banner.tsx` | AI usage and quota awareness banner | Rendered by dashboard surfaces that expose AI actions | Surfaces policy/usage state to users before AI actions |
| `apps/web/src/components/dashboard-nav.tsx` | Primary dashboard nav links | Depends on dashboard nav config | Route-level navigation |
| `apps/web/src/components/onboarding/onboarding-wizard.tsx` | Onboarding flow UI | Uses onboarding hooks/services | Progressive onboarding state |
| `apps/web/src/components/ui/date-pickers.tsx` | Shared shadcn-style date selection primitives | Used by appointments, intake, and onboarding flows with popover/calendar interactions | Replaces native `date`/`month`/`datetime-local` inputs using `DatePicker`, `MonthPicker`, and `DateTimePicker` |
| `apps/web/src/components/ui/availability-calendar.tsx` | Shared availability calendar grid | Used by appointments booking and intake scheduling flows | Compact 7-column month calendar with tap-friendly day chips, disabled unavailable dates, and mobile-first reduced vertical height |
| `apps/web/src/components/customers/customer-form-modal.tsx` | Customer create/edit modal | Calls API via lib/hook layer | CRUD workflow UI |
| `apps/web/src/components/insights/insights-charts.tsx` | Insights chart rendering | Consumes analytics data contracts | Dashboard analytics visualizations |
| `apps/web/src/components/tyvera-assistant.tsx` | Global assistant launcher and compact chat panel UX | Mounted by adaptive app shell; consumes auth/workspace/help/usage utilities | SSE-first assistant chat with cookie-first auth headers, collapsible header snapshot, horizontal prompt chip row, lifecycle states (`sending/streaming/sent/read/error`), `/chat` fallback only for stream transport/protocol failure (not stream `error` events), realtime usage updates from SSE `usage` events, and post-reply `/ai/usage/summary` reconciliation |
| `apps/web/src/components/ui/button.tsx` | Shared UI primitive | Used across feature components | Reusable design-system control |
| `packages/ui/src/Button.tsx` | Workspace-level UI button | Shared package for cross-app reuse | Foundation UI component |
