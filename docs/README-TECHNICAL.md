# Suki — Technical Documentation

Setup, deployment, tech stack, and development guide for the Suki monorepo.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | [Turborepo](https://turbo.build/repo) with Bun workspaces |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **Backend** | NestJS 10, Express |
| **Database** | [Drizzle ORM](https://orm.drizzle.team/) + PostgreSQL |
| **Auth** | [Clerk](https://clerk.com/) |
| **Payments** | [PayMongo](https://paymongo.com/) (Philippines) |
| **Messaging** | Twilio (SMS), Resend (Email) |
| **AI** | OpenAI (message drafting in Promos) |

---

## Project Structure

```
suki/
├── apps/
│   ├── web/           # Next.js frontend (port 3000)
│   └── api/           # NestJS backend (port 3001)
├── packages/
│   ├── config/        # Shared tsconfig presets
│   ├── database/      # Drizzle schema, migrations, client
│   ├── types/         # Shared TypeScript types
│   └── ui/            # Shared React components
├── docs/               # Documentation
├── turbo.json
└── package.json
```

---

## Prerequisites

- **[Bun](https://bun.sh)** >= 1.0
- **PostgreSQL** (local or hosted — e.g. Neon, Supabase, Railway)
- **Node.js** >= 18 (for compatibility with some tooling)

---

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

**Required for development:**

| Variable | Description |
|---------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/suki`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |

**Optional (for full features):**

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | AI message generation (Promos flow) |
| `PAYMONGO_SECRET_KEY` | PayMongo secret key (billing) |
| `PAYMONGO_PUBLIC_KEY` | PayMongo public key |
| `PAYMONGO_WEBHOOK_SECRET` | PayMongo webhook secret for payment events |
| `PII_ENCRYPTION_KEY_BASE64` | 32-byte key (base64) for PII at rest; generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_API_URL` | API URL for frontend (default: `http://localhost:3001`) |

**Twilio (SMS):**

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_PHONE_NUMBER` | Sender identity |
| `TWILIO_STATUS_CALLBACK_URL` | Set to `{API_URL}/messaging/webhooks/twilio/status` for delivery webhooks |

**Resend (Email):**

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender email |
| `RESEND_WEBHOOK_SECRET` | For webhook at `POST {API_URL}/messaging/webhooks/resend` (events: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.failed`) |

**Feature flags (optional):**

| Variable | Description |
|----------|-------------|
| `FF_auto_messaging_enabled` | Enable auto appointment/reminder sends |
| `FF_auto_followups_scheduler_enabled` | Enable scheduler cron jobs |
| `FF_billing_grace_enforced` | Pause messaging when billing `past_due` |
| `FF_sms_metering_enforced` | Enforce SMS caps |
| `FF_security_audit_enabled` | Audit log writes |

Defaults: enabled in dev, disabled in production unless set.

### 3. Database setup

```bash
bun run db:setup
```

Creates the database if needed and runs migrations.

For seed data:

```bash
bun run db:seed
```

---

## Development

```bash
bun run dev
```

Starts Next.js at http://localhost:3000 and NestJS API at http://localhost:3001. Runs `db:setup` first.

**Individual apps:**

```bash
bun run dev:web   # Frontend only
bun run dev:api   # API only
```

---

## Docker (Development)

Run the full stack in Docker with **hot-reload (HMR)**: Postgres + API + Web. File changes are reflected instantly without rebuild.

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

**Setup:**

1. Copy env and fill required vars (Clerk keys, etc.):

   ```bash
   cp .env.example .env
   ```

2. For Docker dev, `DATABASE_URL` is overridden by compose to `postgresql://postgres:postgres@postgres:5432/suki`. You can leave it unset in `.env` or set it for local dev.

**Start dev stack:**

```bash
bun run docker:dev:up
```

Or: `docker compose up -d`

- **Web:** http://localhost:3000  
- **API:** http://localhost:3001  
- **Postgres:** localhost:5433 (user `postgres`, password `postgres`, db `suki`; port 5433 avoids conflict with local Postgres)

**Stop:** `bun run docker:dev:down` or `docker compose down`

**Logs:** `bun run docker:dev:logs` or `docker compose logs -f`

**Validation (HMR):**

- [ ] Edit a component in `apps/web/src` and confirm the change appears in the browser within seconds without rebuild.
- [ ] Edit an API route/controller in `apps/api/src` and confirm the API response changes after Nest restarts (watch mode).
- [ ] Run `bun run db:studio` (or connect to `localhost:5433` with `postgresql://postgres:postgres@localhost:5433/suki`) and verify migrations were applied.

**Troubleshooting:**

| Issue | Fix |
|-------|-----|
| Changes not reflected | Ensure `WATCHPACK_POLLING` / `CHOKIDAR_USEPOLLING` are set (they are in the dev images). On macOS/Windows, file events over bind mounts can be delayed; polling avoids this. |
| `node_modules` empty / install fails | Remove volumes and rebuild: `docker compose down -v` then `docker compose up -d --build`. The entrypoint runs `bun install` when `node_modules` is missing. |
| API can't reach Postgres | Ensure the `api` service `depends_on` postgres with `condition: service_healthy`. |

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps (runs db:setup first) |
| `bun run docker:dev:up` | Start Docker dev stack (Postgres + API + Web with HMR) |
| `bun run docker:dev:down` | Stop Docker dev stack |
| `bun run docker:dev:logs` | Tail logs from dev stack |
| `bun run docker:prod:build` | Build production Docker images |
| `bun run docker:prod:up` | Start production Docker stack |
| `bun run build` | Build all packages |
| `bun run typecheck` | Type check all packages |
| `bun run lint` | Lint all packages |
| `bun run test` | Run tests |
| `bun run test:e2e` | Run E2E tests (apps/web) |
| `bun run clean` | Remove build artifacts and node_modules |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Seed database |
| `bun run db:reset` | Reset database |

---

## Deployment

### Architecture Overview

- **Frontend (apps/web)** — Static/SSR Next.js app
- **API (apps/api)** — Node.js API server
- **Database** — PostgreSQL (managed or self-hosted)

### Docker (Production-like)

Build and run production images locally (no bind mounts):

```bash
bun run docker:prod:build
bun run docker:prod:up
```

Uses `docker-compose.prod.yml`. Migrations run automatically on API startup. For real deployment, use the Dockerfiles with your orchestrator (Kubernetes, ECS, etc.) and connect to a managed database.

**Validation (production smoke test):**

- [ ] `curl http://localhost:3001/health` returns 200.
- [ ] Open http://localhost:3000 and verify a page loads.

### Recommended Hosting

| Component | Options |
|-----------|---------|
| **Frontend** | [Vercel](https://vercel.com), Netlify, Cloudflare Pages |
| **API** | [Railway](https://railway.app), [Render](https://render.com), Fly.io, DigitalOcean App Platform |
| **Database** | [Neon](https://neon.tech), [Supabase](https://supabase.com), Railway, Render |

### Deploying to Vercel (Frontend)

1. Connect the repo to Vercel.
2. Set root directory to project root (or configure build for `apps/web`).
3. Build command: `bun run build:web` (or `cd apps/web && bun run build` if Vercel needs explicit path).
4. Set environment variables in the Vercel dashboard.
5. Ensure `NEXT_PUBLIC_API_URL` points to your deployed API URL.

### Deploying the API (Railway / Render example)

1. Create a new service from the repo.
2. Set root directory to `apps/api` or configure start script.
3. Build: `bun run build` (from monorepo root, or `bun install && bun run build` within `apps/api`).
4. Start command: `node dist/apps/api/src/main.js` (or `bun run start:prod` if using `apps/api` package.json).
5. Set `DATABASE_URL`, `CLERK_SECRET_KEY`, `FRONTEND_URL` (and other env vars).

### Environment Variables in Production

Ensure these are set in your deployment environment:

- `DATABASE_URL` — Production PostgreSQL URL
- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_URL` — Public API URL (for frontend)
- `FRONTEND_URL` — Public frontend URL (for CORS)
- `PAYMONGO_*` — If billing is enabled
- `OPENAI_API_KEY` — If AI messaging is enabled
- `TWILIO_*` / `RESEND_*` — If messaging is enabled
- `PII_ENCRYPTION_KEY_BASE64` — Recommended for production

### Webhooks

- **PayMongo** — Point to `{API_URL}/billing/webhooks/paymongo` or your billing webhook route
- **Clerk** — Configure user/session webhooks to your API as needed
- **Twilio** — `{API_URL}/messaging/webhooks/twilio/status`
- **Resend** — `{API_URL}/messaging/webhooks/resend`

---

## Database Migrations

Generate a new migration after schema changes:

```bash
bun run db:generate
```

Apply migrations:

```bash
bun run db:migrate
```

Inspect data with Drizzle Studio:

```bash
bun run db:studio
```

---

## Rollout & Verification

Feature flags control phased rollout. Health endpoint:

```
GET /health/feature-flags
```

**Verification checklist (before full rollout):**

- [ ] Locked prices visible and consistent across API/UI
- [ ] Basic cannot auto-send; Grow/Pro entitlements enforced
- [ ] SMS counted only on successful send; no sends when opted out
- [ ] STOP webhook suppresses immediately; billing `past_due` pauses automations
- [ ] Audit logs contain action metadata only (no raw PII)

---

## Automation Without OpenAI

Core CRM and workflows run without `OPENAI_API_KEY` or when AI allowance is exhausted:

- QR self-intake, visit stamping
- Loyalty qualification
- Duplicate-aware imports
- Appointment status and reminders
- Pipeline stage movement

AI features are disabled when the key is unset or allowance runs out; the rest of the app continues to work.

---

## Self-Hosted / On-Premises

For self-hosted deployment with signed images and entitlement enforcement, see:

- [docs/on-prem-packaging.md](./on-prem-packaging.md)
- [docs/ONPREM_LICENSING_DESIGN.md](./ONPREM_LICENSING_DESIGN.md)

---

## Troubleshooting

**Database connection fails**

- Ensure PostgreSQL is running and `DATABASE_URL` is correct.
- For Neon/Supabase: check IP allowlist and connection pooling if applicable.

**CORS errors**

- Set `FRONTEND_URL` on the API to match your frontend origin.

**Clerk auth issues**

- Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` match the same Clerk application.
- Ensure callback URLs are configured in the Clerk dashboard.

**Build fails**

- Run `bun run clean` and `bun install` again.
- Ensure `bun run db:setup` has run (some builds may depend on DB package).

**Docker: HMR / watch not detecting changes**

- Ensure you're using the `dev` target (default in `docker-compose.yml`). Polling env vars (`WATCHPACK_POLLING`, `CHOKIDAR_USEPOLLING`) are set in the dev images.
