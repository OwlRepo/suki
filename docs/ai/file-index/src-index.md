Last updated: 2026-05-03T12:46:06.000Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Source Index

| Path | Purpose | Main Exports | Dependencies | Consumers | Usage Patterns | Risk |
|---|---|---|---|---|---|---|
| `apps/web/src/app` | Next.js routing and page composition | layouts/pages/providers | Next.js, Clerk, shared packages | browser users | app-router and route-segment architecture | High |
| `apps/web/src/components` | UI and feature components | feature/component modules | React, UI primitives | pages/layouts | feature UIs and shared visual blocks | Medium |
| `apps/web/src/hooks` | reusable client logic | custom hooks | React, lib/api | components/pages | data and state orchestration | Medium |
| `apps/web/src/lib` | shared frontend utilities | helper modules | env + fetch + utils | hooks/components/routes | API integration and helper logic | Medium |
| `apps/api/src` | backend module system | Nest modules/controllers/services | NestJS, shared DB/types | web app + provider callbacks | domain-driven REST + webhook handling | High |
| `packages/database/src` | DB client/contracts | db module exports | postgres, drizzle | api and package consumers | persistence abstraction | High |
| `packages/database/scripts` | migration and maintenance scripts | script entrypoints | database env + drizzle | operators/dev workflows | schema/data lifecycle ops | High |
| `packages/ui/src` | shared UI primitives | component exports | React | web app | reusable design system primitives | Medium |
| `packages/types/src` | shared TypeScript contracts | type exports | TypeScript | web/api/database | cross-package contracts | Medium |
