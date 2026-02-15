# Suki

AI-powered customer engagement CRM for Philippine small businesses. Capture customers, send follow-ups, and grow repeat visits.

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
│   └── api/       # NestJS backend
├── packages/
│   ├── config/    # Shared tsconfig presets
│   ├── database/  # Drizzle schema, migrations, client
│   ├── types/     # Shared TypeScript types
│   └── ui/        # Shared React components
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

Required for development:

- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/suki`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (for auth)
- `CLERK_SECRET_KEY` — Clerk secret key

Optional (for full features):

- `OPENAI_API_KEY` — AI message generation
- `PAYMONGO_SECRET_KEY` / `PAYMONGO_PUBLIC_KEY` — Billing

### 3. Database setup

```bash
bun run db:setup
```

This creates the database if needed and runs migrations. For seed data:

```bash
bun run db:seed
```

## Development

```bash
bun run dev
```

Starts both the Next.js app (http://localhost:3000) and NestJS API (http://localhost:3001).

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
# suki
