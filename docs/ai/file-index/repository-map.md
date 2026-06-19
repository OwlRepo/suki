Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-18T18:07:23.439Z
# Repository Map

Use this first. One dense map. Update rows only.

| Path | Purpose | Main Exports / Shapes | Main Dependencies | Main Consumers | Usage Pattern | Risk |
|---|---|---|---|---|---|---|
| `apps/web/src/app` | Next.js route tree | layouts, pages, route segments | Next.js, auth, hooks, UI | browser users | app-router surfaces for dashboard, onboarding, intake, auth, client billing requests, platform-admin inbox | High |
| `apps/web/src/components` | feature UI and reusable view pieces | React components | hooks, lib, shared UI | pages, layouts | dashboard widgets, onboarding, customer UI, assistant UI, billing request forms and admin review views | Medium |
| `apps/web/src/hooks` | reusable client logic | custom hooks | React, lib/api | components, pages | auth sync, onboarding progress, billing, flags | Medium |
| `apps/web/src/lib` | frontend helpers | API helpers, auth helpers, utils | env, fetch, Clerk | hooks, routes, components | request plumbing, route protection, domain helpers | High |
| `apps/web/src/contexts` | React context providers | provider components | React | app tree | cross-route client state where local state not enough | Medium |
| `apps/web/src/domains` | web domain modules | feature-specific helpers/types | app code | web features | keep feature logic near UI domain | Medium |
| `apps/api/src` | NestJS backend modules | controllers, services, modules | NestJS, DB, shared types | web app, provider callbacks | business rules, validation, integrations, API contracts | High |
| `apps/api/src/common` | shared API guards/policies | guards, filters, helpers | NestJS, env, auth context | many API modules | access control, feature gating, shared exceptions | High |
| `apps/api/src/help` | assistant support logic | help services, governance helpers | API internals | AI/help flows, governance scripts | assistant orchestration, context policy, compact AI manifest/index enforcement | High |
| `apps/api/src/ai` | AI execution zone | AI services/controllers | OpenAI, quotas, policy helpers | messaging, help, admin flows | generation, orchestration, limits | High |
| `apps/api/src/messaging` | outbound/inbound messaging | controllers, services, provider adapters, idempotent Semaphore reconciliation | Semaphore, Twilio, Resend, AI, DB | dashboard messaging flows, webhooks | compose, send, meter, normalize IDs, repair false rejections with parameterized filters, `jsonb_exists`, and sent markers, receive, webhook verify | High |
| `apps/api/src/automation` | automation settings, scheduling, and send orchestration | controller, settings/send/composer/scheduler services | DB, messaging dispatch, feature flags | settings UI, appointments, intake, customers, scheduler | persist per-business templates/toggles and compose automated messages at send time | High |
| `apps/api/src/auth` | auth/session sync | controller, service, guards | Clerk backend, DB | web auth flows | user sync and auth checks | High |
| `apps/api/src/imports` | import workflows | controller, services | csv/xlsx/OCR, DB | imports UI | upload, map, apply, repair | High |
| `apps/api/src/appointments` | appointment domain | controllers/services | DB, policy helpers | dashboard appointments | schedule, check-in, review states | High |
| `apps/api/src/customers` | customer domain | controller, services | DB | dashboard customers | retention records and CRUD | High |
| `apps/api/src/intake` | public intake flow | controller, services | DB, validation | intake web route | public booking/intake | High |
| `apps/api/src/billing` | billing compatibility and client-intent layer | controllers, webhook controller, billing and client-request services | provider HTTP, DB, feature flags | settings/billing UI, callbacks, platform admin | billing state, checkout/webhook compatibility, tenant-scoped manual billing intent | High |
| `apps/api/src/platform-admin` | founder-led admin operations | services/controllers, serialized billing and client-request details | DB, billing helpers | internal admin flows | client request inbox, approval into manual billing, payment recording, subscription, and lifecycle work | High |
| `packages/database/src` | DB contracts/runtime | `db`, schema exports, helpers | PostgreSQL, Drizzle | API, scripts, shared consumers | shared persistence contract | High |
| `packages/database/src/schema` | schema definitions | tables/enums/relations, client billing request entity | Drizzle | DB package, API services | DB source of truth | High |
| `packages/database/scripts` | DB lifecycle scripts | setup/migrate/seed/reset/reconcile, platform-admin RBAC seed | DB env, Drizzle | dev workflows, ops | schema/data lifecycle and client billing inbox permissions | High |
| `packages/ui/src` | shared UI package | buttons, inputs, cards, dialogs | React | web app | reusable visual primitives | Medium |
| `packages/types/src` | shared TS contracts | type exports | TypeScript | web, API, DB | cross-package compile-time alignment | Medium |
| `packages/config` | shared config package | config helpers | TS/runtime config | workspace packages | central config where needed | Medium |
| `CLAUDE.md` | Claude planner contract | role, routing, handoff format, gates | `AGENTS.md`, `docs/ai/*` | Claude Code | read-only planning; writes only approved scratchpad handoff | Medium |
| `.claude/settings.json` | Claude enforcement | Plan default, Bash/subagent deny, scratchpad-only write hook | Claude Code settings | Claude Code | blocks implementation mutations from planner | High |
| `.codex/instructions.md` | Codex executor contract | mechanical execution, TDD, safety, docs sync | `AGENTS.md`, `.ai-scratchpad.md` | OpenAI Codex | execute approved directives without redesign | High |
| `.ai-scratchpad.md` | transient handoff truth | `CAVE PLAN`, directives, verification | Claude planner | Codex executor | overwrite per approved mutation task | High |
| `docs/ai/entry-point.md` | universal AI root | load order, lanes, TDD, gates | architecture manifest, repository ledger | `AGENTS.md`, Claude, Codex, humans | first repository instruction hop | Medium |
| `docs/ai/architecture-manifest.md` | dense architecture truth | code map, boundaries, routes, schema, services, tests, commands, risk | manifests, source, tests, workflow config | Claude, Codex, humans | first code-task context file | High |
| `docs/ai/file-index/repository-map.md` | dense navigation ledger | path ownership, consumers, risk | current repository tree | Claude, Codex, humans | second code-task context file; affected rows only | Medium |
| `docs/assistant-context` | user-facing assistant knowledge | localized markdown topics | product behavior, help routes | help assistant context loader | answer guidance; sync when assistant-facing behavior changes | Medium |
| `scripts/update-ai-indexes.ts` | AI doc metadata stamper | script entry | Bun FS APIs | developers | refresh markdown headers in `docs/ai` | Low |
| `scripts/check-assistant-context-governance.ts` | context governance check | script entry | git, governance helper | developers, CI/manual checks | require assistant context, repository ledger, architecture manifest sync on behavior-impacting changes | Medium |
| `apps/api/src/**/*.spec.ts` | API test suites | vitest specs | vitest, Nest testing | dev/CI | unit and integration regression coverage | Medium |
| `apps/web/src/**/*.test.ts(x)` | web test suites | vitest specs | vitest, RTL | dev/CI | component and hook regression coverage | Medium |
| `apps/web/cypress/e2e` | browser e2e specs | Cypress tests | running web + API | dev/CI | end-to-end user journey checks | High |
