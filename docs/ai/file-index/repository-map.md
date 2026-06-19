# Repository Map

Purpose:

Dense file ledger for quick navigation.

This file is map only.

It is not proof of behavior.

Use it to find likely files.

Verify behavior against source.

## Index

| Path | Purpose | Main Exports / Shapes | Main Dependencies | Main Consumers | Usage Pattern | Risk |
|---|---|---|---|---|---|---|
| `apps/web/src/app` | Next.js route tree | layouts, pages, route segments | Next.js, auth, hooks, UI | browser users | dashboard, platform-admin, onboarding, intake, auth, pricing | High |
| `apps/web/src/components` | feature UI and reusable view pieces | React components | hooks, lib, shared UI | pages, layouts | billing, customers, assistant, platform-admin, share-slots, landing | Medium |
| `apps/web/src/hooks` | reusable client logic | hooks | React, API helpers | components, pages | billing status, workspace sync, other feature hooks | Medium |
| `apps/web/src/lib` | frontend helpers and API plumbing | `apiRequest`, auth helpers, route helpers | env, fetch, Clerk | app, hooks, components | API base URL, auth client, protected route logic, onboarding rules | High |
| `apps/web/src/domains` | feature-specific web modules | helpers and types | app code | web features | domain-local logic, platform helpers | Medium |
| `apps/web/src/test` | web test helpers | fixtures and helpers | vitest, RTL | web tests | shared test setup | Medium |
| `apps/api/src` | NestJS backend modules | controllers, services, modules | NestJS, DB, shared types | web app, provider callbacks | business rules, validation, integration boundaries | High |
| `apps/api/src/common` | shared guards and policies | guards, services, filters | auth context, env | many API modules | cross-cutting access and billing state checks | High |
| `apps/api/src/auth` | auth and session sync | controller, service, guards | Clerk, DB | web auth flows | sign-in/up bootstrap, auth me, workspace/session sync | High |
| `apps/api/src/customers` | customer domain | controller, services | DB, messaging | dashboard customers, appointments, privacy | CRUD, templates, follow-up, visit history | High |
| `apps/api/src/appointments` | appointment and booking domain | controller, services, scheduler | DB, policy helpers | appointments UI, public booking helpers | scheduling, arrive/status transitions, booking holds, share templates | High |
| `apps/api/src/intake` | public intake flow | controller, booking service | DB, OTP, validation | intake web route | public booking, holds, OTP verification | High |
| `apps/api/src/automation` | automation configuration and send orchestration | controller, settings/send/scheduler services | DB, messaging, AI | settings UI, operations | scheduled automation and message refinement | High |
| `apps/api/src/messaging` | outbound/inbound messaging | controllers, services, provider adapters | DB, providers, AI | dashboard messaging flows, webhooks, automations | delivery, metering, webhook validation, follow-up retry | High |
| `apps/api/src/billing` | tenant billing and client billing requests | controllers, services | provider HTTP, DB | billing UI, platform-admin, callbacks | billing status, checkout, request capture, webhook compatibility | High |
| `apps/api/src/platform-admin` | internal admin operations | controller, services, guard | DB, billing, messaging, ops | platform-admin UI | client requests, manual billing, communications, alerts, audit | High |
| `apps/api/src/help` | assistant and governance logic | controllers, read models, tool policy | appointments, customers, automation, AI | help assistant UI, governance scripts | AI orchestration, safe tools, context policy | High |
| `apps/api/src/imports` | import workflows | controller, services | csv/xlsx/OCR, DB | imports UI | parse, dry-run, commit, rollback | High |
| `apps/api/src/insights` | insights read models | controller, service | DB | insights UI | monthly and monitoring summaries | Medium |
| `apps/api/src/organizations` | org profile | controller, service | DB | settings and org flows | org read/update and recommendations | Medium |
| `apps/api/src/businesses` | business profile | controller, service | DB | settings, onboarding | business list/detail/update and CRM mode | Medium |
| `apps/api/src/users` | workspace switching | controller, service | DB | workspace selector | active workspace read/update | Medium |
| `apps/api/src/security` | privacy and audit surfaces | controller, services | DB, crypto | privacy flows, admin audit | export, correct, anonymize, audit helpers | High |
| `apps/api/src/operations` | ops visibility | services | DB, provider adapters | platform-admin operations pages | automation run summaries, provider health, alerts | High |
| `apps/api/src/admin` | admin read and org billing tools | controller | DB | internal admin surfaces | summary, activity, usage, org billing | High |
| `apps/api/src/crm` | CRM lane | controllers, services | DB | CRM surfaces | deals, activities, tasks, custom fields | Medium |
| `apps/api/src/licensing` | licensing and OTA | controllers, services | DB | licensing flows | activate, attest, offline activate, OTA manifest | Medium |
| `apps/api/src/promos` | promotions | controller, service | DB | promos UI | CRUD and send actions | Medium |
| `apps/api/src/loyalty` | loyalty status | controller | DB | loyalty UI | status reads | Medium |
| `apps/api/src/workflows` | workflow templates | controller, service | DB or static data | workflow consumers | template lookup | Medium |
| `packages/database/src/schema/index.ts` | DB source of truth | Drizzle tables and enums | Drizzle PG core | API services, DB scripts | schema and contract truth | High |
| `packages/database/scripts` | DB lifecycle scripts | setup, migrate, seed, reset, reconcile | Bun, DB env | dev workflows | schema/data lifecycle | High |
| `packages/ui/src` | shared UI primitives | reusable components | React | web app | shared visual building blocks | Medium |
| `packages/types/src` | shared TS contracts | type exports | TypeScript | web, API, DB | compile-time shared types | Medium |
| `packages/config` | shared config | config helpers | runtime config | workspace packages | central config | Medium |
| `packages/admin-database` | extra DB artifact package | built JS and d.ts files | TypeScript build output | unknown | source not verified during bootstrap | Medium |
| `CLAUDE.md` | Claude router and planner contract | workflow rules | `docs/ai/*` | Claude Code | routing, RCA, planning, handoff | High |
| `AGENTS.md` | root loader pointer | load order | `CLAUDE.md`, `docs/ai/*` | agents | first repo hop | Medium |
| `.claude/settings.json` | Claude Code project policy | permissions and hooks | Claude Code settings schema | Claude Code | plan-only, scratchpad-only write | High |
| `.codex/instructions.md` | Codex executor contract | execution rules | `.ai-scratchpad.md` | Codex | implement and validate only | High |
| `.ai-scratchpad.md` | transient handoff shell | status-gated task template | Claude planner | Codex executor | temporary mechanical handoff truth | High |
| `docs/ai/entry-point.md` | workflow summary | developer flow and load order | router and maps | humans, Claude, Codex | repo AI entry | Medium |
| `docs/ai/task-router.md` | raw task classifier | workflow table | module, contract, risk maps | Claude | route raw requests | High |
| `docs/ai/module-ownership-map.md` | business-domain map | domain table | verified repo scan | Claude | find likely areas by domain | High |
| `docs/ai/contracts` | contract maps | API and DB tables | source verification | Claude | find contract boundaries | High |
| `docs/ai/testing-strategy.md` | verification map | task-size matrix | package scripts | Claude, Codex | choose safe checks | Medium |
| `docs/ai/risk-register.md` | risk map | risk table | repo scan | Claude | classify Deep work | Medium |
| `docs/ai/context-refresh.md` | stale-doc refresh workflow | refresh steps | source verification | Claude | refresh docs without source edits | Medium |
| `docs/ai/prompts` | detailed planner templates | prompt docs | router contract | Claude | RCA, bug plan, feature plan, refactor plan | Medium |
| `docs/assistant-context` | user-facing assistant knowledge | localized markdown topics | product behavior, help routes | help assistant loader | answer guidance for in-product assistant | Medium |
| `scripts/update-ai-indexes.ts` | AI doc metadata stamper | script entry | Bun FS APIs | developers | refresh markdown index headers | Low |
| `scripts/check-assistant-context-governance.ts` | governance check | script entry | git, governance helper | developers, CI | ensure assistant context and AI maps stay in sync | Medium |
| `.github/workflows/deploy.yml` | deploy workflow | GitHub Actions YAML | Docker and env | CI/CD | production deployment path | High |
