# Architecture Manifest

Purpose:

Dense project map for routing and planning.

This file is map only.

It is not proof of behavior.

Verify all conclusions against real source code, tests, types, schemas, routes, controllers, services, stores, components, API contracts, database definitions, and workflow files.

## Project Shape

- Monorepo with root `package.json` workspaces for `apps/*` and `packages/*`
- Runtime tooling: Bun + Turborepo
- Web app: `apps/web` using Next.js App Router
- API app: `apps/api` using NestJS
- Main DB package: `packages/database` using Drizzle + PostgreSQL
- Shared packages: `packages/ui`, `packages/types`, `packages/config`
- Extra package path present: `packages/admin-database`
  Source package metadata not found during bootstrap scan. Treat as built artifact package until verified.
- Infra and workflow files: `docker-compose.yml`, `docker-compose.prod.yml`, `.github/workflows/deploy.yml`

## Frontend

- Main route groups: dashboard, platform-admin, intake, onboarding, auth, pricing
- Key dashboard areas: appointments, customers, imports, insights, settings, billing, help, loyalty, promos
- Platform-admin surfaces: communications, automation-runs, alerts, businesses, client-requests, billing-requests, audit-logs
- Shared feature UI under `apps/web/src/components`
- API calls use `apps/web/src/lib/api.ts` and `apps/web/src/lib/api-base.ts`

## Backend

- API modules verified from `apps/api/src`: auth, appointments, automation, billing, businesses, common, crm, customers, health, help, imports, insights, intake, licensing, loyalty, messaging, onboarding, operations, organizations, platform-admin, promos, security, users, workflows
- Route truth lives in `*.controller.ts`
- Business logic mainly in `*.service.ts`
- Guards and cross-cutting policy in `apps/api/src/common`, `apps/api/src/auth`, `apps/api/src/platform-admin`

## Database / Schema

- Main schema source: `packages/database/src/schema/index.ts`
- Verified tables include organizations, businesses, users, customers, appointments, booking tables, automation tables, message and credit tables, AI usage tables, billing request tables, privacy and audit tables
- Migration history present in `packages/database/drizzle/*.sql`
- DB lifecycle scripts present in `packages/database/scripts`

## API Contracts

- Billing and client request routes span dashboard billing UI and platform-admin inbox
- Appointment, intake, and customer routes cross dashboard and public booking flows
- Automation and messaging routes cross settings, providers, and admin operations
- Help and AI routes cross assistant UX and backend policy enforcement
- Exact DTO truth must be verified in controller, service, type, and test source

## Auth / Permissions

- Clerk is verified frontend and backend auth dependency
- Workspace and role logic touch `apps/api/src/auth`, `apps/api/src/users`, `apps/api/src/common/*guard*`, `apps/web/src/lib/protected-routes.ts`, and platform-admin guard paths
- Privacy and audit routes live in `apps/api/src/security`

## Jobs / Automations

- Automation send, scheduler, trigger, composer, and settings services live in `apps/api/src/automation`
- Operations visibility lives in `apps/api/src/operations`
- Appointment lifecycle scheduler also exists under appointments
- Provider health and alerts exist under operations and platform-admin routes

## External Integrations

- Clerk: auth
- OpenAI: AI and assistant flows
- PayMongo and LemonSqueezy: billing/payment paths
- Twilio and Semaphore: SMS and webhook paths
- Resend: email
- PostgreSQL: primary persistence
- Svix dependency present in root package. Source usage not verified in bootstrap scan.

## Verification Commands

Verified from package scripts:

- `bun run build`
- `bun run build:web`
- `bun run build:api`
- `bun run typecheck`
- `bun run lint`
- `bun run test`
- `bun run update:ai-indexes`
- `bun run check:assistant-context-governance`

## Risk Notes

- Deep by default: billing, payments, SMS credits, auth, permissions, automations, webhooks, migrations, transactions
- Medium risk: imports, platform-admin read models, shared package contract changes
- Low risk: docs, prompts, AI workflow bootstrap files
