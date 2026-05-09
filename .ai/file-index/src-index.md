# Source Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `apps/web/src/app/layout.tsx` | Web root layout and providers wiring | Uses `providers.tsx`, shared UI | Entry point for all web routes |
| `apps/web/src/app/(dashboard)/layout.tsx` | Dashboard shell composition | Uses navigation components and workspace context | Shared frame for authenticated app pages |
| `apps/api/src/main.ts` | Nest application bootstrap | Loads `AppModule`, global pipe/filter | API process entry point |
| `apps/api/src/app.module.ts` | Top-level API module composition | Imports domain modules and shared modules | Central dependency wiring |
| `packages/database/src/index.ts` | DB package public exports | Re-exports schema/db helpers | Imported by API services |
