# Architecture Overview

Suki is a Bun + Turborepo monorepo with:
- `apps/web`: Next.js 16 frontend (App Router, React 19)
- `apps/api`: NestJS 10 REST API
- `packages/database`: shared Drizzle SQL schema/migrations/scripts
- `packages/ui`, `packages/types`, `packages/config`: shared workspace libraries

Primary runtime flow:
1. Web UI calls API endpoints.
2. API enforces auth/tenant/plan guards and executes domain services.
3. Services persist and query data via shared database package.
4. Integrations (Clerk, Twilio, Resend, PayMongo, OpenAI, CRM providers) are invoked in module-specific service layers.

Canonical AI documentation root is `.ai/`. Legacy `docs/ai/` remains non-canonical reference.
