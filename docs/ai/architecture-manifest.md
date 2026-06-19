Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-18T18:07:23.439Z
# Architecture Manifest

Source truth: manifests, source, tests, schema, workflow config.

## Repo

- Monorepo: Bun + Turborepo.
- Web: `apps/web` — Next.js App Router.
- API: `apps/api` — NestJS.
- DB: `packages/database` — Drizzle + PostgreSQL.
- Shared: `packages/ui`, `packages/types`, `packages/config`.
- Infra: `docker-compose.yml`, `docker-compose.prod.yml`, `.github/workflows/deploy.yml`.

## AI Pipeline

- Claude Code: read-only planner. Contract: `CLAUDE.md`.
- Claude enforcement: `.claude/settings.json`.
- Codex: mechanical executor. Contract: `.codex/instructions.md`.
- Handoff truth: `.ai-scratchpad.md`.
- Root instruction hop: `AGENTS.md` -> `docs/ai/entry-point.md`.
- Architecture truth: this file.
- Navigation truth: `docs/ai/file-index/repository-map.md`.
- Assistant-context governance requires both compact AI docs when behavior-impacting help/AI files change.

## Boundaries

- Web renders UI. Calls API/contracts.
- API owns business rules, validation, policy, provider calls.
- DB package owns schema, migrations, seeds, repair scripts.
- Shared packages stay reusable and backward-compatible.
- Browser code gets no DB behavior.
- Provider contracts stay in API modules.

## Main Flows

- Auth/session: `apps/web/src/lib/auth*` <-> `apps/api/src/auth/*`.
- Onboarding: `apps/web/src/app/onboarding` <-> `apps/api/src/onboarding/*`.
- Appointments: `apps/web/src/app/(dashboard)/appointments` <-> `apps/api/src/appointments/*`.
- Customers/intake: dashboard customer UI + `apps/web/src/app/intake/[businessId]` <-> `apps/api/src/customers/*`, `apps/api/src/intake/*`.
- Automation: settings UI <-> `apps/api/src/automation/*` -> `apps/api/src/messaging/*`.
- Messaging/AI: `apps/api/src/messaging/*` owns delivery/provider behavior. `apps/api/src/ai/*` owns generation, limits, policy.
- Billing/access: client billing settings submit tenant-scoped intent through `apps/api/src/billing/*`; `apps/api/src/platform-admin/*` reviews it and reuses manual billing request/payment/fulfillment paths.
- Imports: `apps/web/src/app/(dashboard)/imports` <-> `apps/api/src/imports/*`.

## API / Middleware

- Routes: `apps/api/src/**/*.controller.ts`.
- Main domains: auth, organizations, businesses, customers, intake, appointments, onboarding, automation, messaging, webhooks, insights, imports, billing, admin, AI, licensing, privacy, health.
- Guards, filters, policy: `apps/api/src/common`, `apps/api/src/auth`.
- Errors: NestJS exceptions + shared filters.
- Route contract change requires request/response tests and consumer check.

## Auth / Security

- Clerk owns frontend auth and backend session verification.
- Preserve session, organization, workspace access checks.
- Validate external input.
- Preserve authz boundaries.
- Client billing submission/cancel is owner-only; platform inbox uses dedicated view/resolve permissions.
- Never expose secrets.
- Use parameterized ORM paths.
- Verify provider webhook signatures.

## Data

- Schema: `packages/database/src/schema`.
- Runtime: `packages/database/src/database.ts`, `packages/database/src/index.ts`.
- Config: `packages/database/drizzle.config.ts`.
- Lifecycle: `packages/database/scripts/{setup,migrate,seed,reset,reconcile-orphans}.ts`.
- Prefer additive schema change.
- `client_billing_requests` stores plan-change, SMS top-up, and cancellation intent separately from payable `manual_billing_requests`; approval links payable requests when applicable.
- Never run production migration from agent workflow.

## External Services

- Clerk: auth/session.
- OpenAI: generation/orchestration.
- PayMongo: billing/webhooks.
- Twilio and Semaphore: SMS.
- Resend: email.
- PostgreSQL: persistence.
- Svix: root dependency; source usage unverified.

## Tests

- API: `apps/api/src/**/*.spec.ts`.
- Web: `apps/web/src/**/*.test.ts(x)`, `apps/web/src/**/*.spec.ts(x)`.
- E2E: `apps/web/cypress/e2e/*.cy.ts`.
- Shared: package-local `*.spec.ts`.
- Behavior change: RED -> GREEN -> REFACTOR.
- Bug fix: regression test first.

## Commands

- Core: `bun run dev`, `bun run build`, `bun run typecheck`, `bun run lint`, `bun run test`.
- Scoped: `bun run dev:web`, `bun run dev:api`, `bun run build:web`, `bun run build:api`.
- DB: `bun run db:setup`, `bun run db:generate`, `bun run db:migrate`, `bun run db:seed`, `bun run db:reset`, `bun run db:reconcile-orphans`, `bun run db:studio`.
- AI docs: `bun run update:ai-indexes`, `bun run check:assistant-context-governance`.

## Risk

- High: auth, billing, security, AI policy, DB/schema, provider webhooks, CI/CD, Docker production.
- Medium: shared packages, route contracts, onboarding, imports.
- Low: docs, prompts, file ledger, non-behavioral editor config.

## Performance

- Web: avoid waterfalls, oversized client components, rerender waste.
- API: avoid N+1 queries, blocking request work, unpaginated lists.
- Validate early. Paginate large data.
