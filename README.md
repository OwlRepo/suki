# Suki

CRM for growing service businesses. Fix CRM chaos without adding complexity—one workspace, cleaner customer records, and a path that scales. Less manual work, fewer mistakes, faster decisions.

## What Suki Does

- **Business setup** — Guided questions, workspace context, and recommended modules by business type (salon, clinic, restaurant, retail, spa, gym, etc.)
- **Customers** — Add manually, QR signup link for self-intake, or import from spreadsheets. Search and filter by name or labels. Track visit count and last visit per customer.
- **Appointments** — Schedule, reschedule, update status (scheduled / completed / missed / cancelled). Mark reminder sent. Time presets (morning, afternoon, evening).
- **Promos** — Create offers from templates (e.g. "We miss you", "Come back & save"). Target by min visits or max inactive days. AI-assisted message drafting when OpenAI is enabled.
- **Loyalty** — See customers who qualify by visit threshold. Adjust threshold (3+, 5+, 10+, etc.) and filter by label.
- **Insights** — Monthly new vs repeat customers, repeat visits. Plain-language metrics. Month/year selector.
- **Imports & migration** — CSV, Excel, HubSpot, or Pipedrive. Duplicate check, dry-run preview, reconciliation report, and rollback.
- **Pipeline** — Deal stages and deals (CRM Full mode). Add stages, create deals, move between stages.
- **Settings** — Organization name, business names, CRM mode toggle (Lite/Full), billing/plans, and AI usage and quotas.

## How It Works

1. **Capture customers** — QR signup link, manual entry, or import from spreadsheets.
2. **Track repeat behavior** — See new vs repeat customers every month. Last visit and visit count per customer.
3. **Take one-tap actions** — Send promos or reminders in under a minute. AI can write the message; you choose the offer and audience.

## Automation Capabilities

### With OpenAI enabled

- **AI-assisted message drafting** — Generate promo and reminder copy from a prompt in the Promos flow (`/messaging/generate`). Available on AI Pro plan.
- **AI usage and quotas** — Token/request limits, soft cap, enabled toggle, and feature breakdown in Settings.

### Without OpenAI

The core CRM and workflow automation still run without an API key or when AI allowance is exhausted:

- **QR self-intake** — Customers add themselves via shared QR or link; no staff typing.
- **Visit stamping** — One-tap record of a customer visit; updates last visit and visit count.
- **Loyalty qualification** — Automatic qualification by configurable visit threshold; no AI required.
- **Duplicate-aware imports** — Parse, preview duplicates, dry-run, commit, and rollback; validation and reconciliation.
- **Appointment status and reminders** — Schedule, status updates, and "reminder sent" tracking.
- **Pipeline stage movement** — Move deals between stages in CRM Full mode.

If `OPENAI_API_KEY` is not set or AI allowance runs out, AI features are disabled; the rest of the app continues to work.

## Plans & Modes

- **Basic (₱499/mo)** — Customer list, QR signup, manual entry, last visit & visit count, new customers this month, CSV/data migration.
- **Grow (₱999/mo)** — Everything in Basic + one focused module (Promos or Appointments), new vs repeat monthly, AI-assisted message writing.
- **Pro (₱1,499/mo)** — Everything in Grow + two modules at once, month-to-month comparison, higher AI allowance.

**CRM Lite vs Full** — Lite: core customer management, simple campaign and loyalty workflows. Full (Growth/AI Pro): advanced pipeline and workflow automation, expanded analytics. Records stay compatible across both modes.

## Stack

- **Monorepo**: Turborepo with Bun workspaces
- **Frontend**: Next.js 15 (App Router, TypeScript, Tailwind)
- **Backend**: NestJS
- **Database**: Drizzle ORM + PostgreSQL
- **Auth**: Clerk
- **Payments**: PayMongo (Philippines)

## Project Structure

```
suki/
├── apps/
│   ├── web/        # Next.js frontend
│   └── api/        # NestJS backend
├── packages/
│   ├── config/     # Shared tsconfig presets
│   ├── database/   # Drizzle schema, migrations, client
│   ├── types/      # Shared TypeScript types
│   └── ui/         # Shared React components
├── turbo.json
└── package.json
```

## Setup

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- PostgreSQL (local or hosted)

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

- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/suki`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `CLERK_SECRET_KEY` — Clerk secret key

**Optional (for full features):**

- `OPENAI_API_KEY` — AI message generation (Promos flow)
- `PAYMONGO_SECRET_KEY` / `PAYMONGO_PUBLIC_KEY` — Billing

### 3. Database setup

```bash
bun run db:setup
```

Creates the database if needed and runs migrations. For seed data:

```bash
bun run db:seed
```

## Development

```bash
bun run dev
```

Starts Next.js (http://localhost:3000) and NestJS API (http://localhost:3001). Runs `db:setup` first.

Individual apps:

```bash
bun run dev:web   # Frontend only
bun run dev:api   # API only
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps (runs db:setup first) |
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

## Deployment

- **Frontend**: Deploy `apps/web` to Vercel or similar
- **API**: Deploy `apps/api` to a Node.js host (e.g. Railway, Render)
- **Database**: Use a managed PostgreSQL (Neon, Supabase, etc.)

Set all environment variables in your deployment environment.
