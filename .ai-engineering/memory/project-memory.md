# Project Memory

Verified facts only; each line cites its evidence. Update when a fact changes.

## Architecture

- Bun + Turborepo monorepo: `apps/web` (Next.js 16.1.6), `apps/api` (NestJS 10), `packages/database` (Drizzle, PostgreSQL 16), `packages/types`, `packages/ui`, `packages/config` (`package.json`, `apps/*/package.json`, `docker-compose.yml`).
- The web app talks to the API over HTTP via `apiRequest` (`apps/web/src/lib/api.ts`).
- Production is one VPS; push to `main` deploys (`.github/workflows/deploy.yml`); the API container applies Drizzle migrations on start (`apps/api/Dockerfile`).

## Business rules (Deep by default)

- Billing, payments, SMS credits, plan upgrades, auth/permissions, automations, jobs, webhooks, migrations, transactions (`docs/ai/risk-register.md`).

## Constraints

- No breaking change without a labelled `BREAKING CHANGE` and explicit user approval (`AGENTS.md`).
- Strict TDD enforced by hook and CI (`docs/ai/testing-strategy.md`).
- The legacy brand string is banned from tracked text (`apps/api/src/test/rebrand-governance.spec.ts`).

## Important decisions

- See `memory/architecture-decisions.md`.
