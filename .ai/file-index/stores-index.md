# Stores Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/contexts/workspace-context.tsx` | Workspace-scoped state container | Consumed by dashboard routes/components | Organization/workspace selection state |
| `apps/web/src/lib/dev-store.ts` | Lightweight local dev state helpers | Used by developer mode utilities | Local non-production testing paths |
