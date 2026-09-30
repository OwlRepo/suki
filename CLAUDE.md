@AGENTS.md

# Tyvera — Project Context

> Facts below cite the file that proves them. If anything here contradicts the
> code, the code wins — fix this file in the same PR (`CONTEXT DRIFT`).

## What it is

Tyvera: appointment, customer, messaging, and automation software for small
service businesses, with a platform-admin console and a public intake/booking
flow (`README.md`, `apps/web/src/app`, `apps/api/src`). Production runs at
`https://tyvera.app` (`.github/workflows/deploy.yml` smoke check).

## Tech stack (verified)

- **Monorepo:** Bun workspaces (`apps/*`, `packages/*`) + Turborepo (`package.json`, `turbo.json`). Use `bun run <script>`; never `npm install`. Local toolchain: bun 1.2.x reads the text `bun.lock` (`packageManager: bun@1.0.0` in `package.json` is stale).
- **Web:** `apps/web` — Next.js 16.1.6 App Router, React 19.2.3, Tailwind CSS v4, Radix (`radix-ui`), lucide-react, next-themes (`apps/web/package.json`). Production build `next build --webpack`. Proxy/middleware: `apps/web/src/proxy.ts`. API client: `apiRequest` in `apps/web/src/lib/api.ts`.
- **API:** `apps/api` — NestJS 10 on Express, global `ValidationPipe` + class-validator DTOs (`apps/api/src/main.ts`), `@nestjs/schedule` for schedulers (`apps/api/package.json`).
- **Database:** PostgreSQL 16 (`docker-compose.yml`, `docker-compose.prod.yml`) via Drizzle ORM in `packages/database` — schema `packages/database/src/schema/index.ts`, migrations `packages/database/drizzle/*.sql` (`packages/database/drizzle.config.ts`). No RLS; tenant scoping is enforced in API services and guards.
- **Shared packages:** `packages/types` (contract types), `packages/ui` (shared React components), `packages/config`.
- **Tests:** vitest 3 per workspace (`apps/web` jsdom, `apps/api` node, `packages/types`) through `turbo run test`; workflow scripts use `node:test` (`bun run test:scripts`).
- **Integrations:** Clerk + local auth tables, OpenAI, Twilio, Semaphore, Resend, PayMongo, LemonSqueezy (`docs/ai/architecture-manifest.md` "External Integrations"; verify in source before relying on one).
- **Deploy:** push to `main` → `.github/workflows/deploy.yml` SSHes to the VPS, takes a `pg_dump` backup, builds `api` then `web` with `docker-compose.prod.yml`, and health-checks `:3001/health`, `:3000`, and the public site. Pending Drizzle migrations apply when the API container starts (`apps/api/Dockerfile` CMD runs `packages/database/scripts/migrate.ts`).

## Next.js 16 — mandatory patterns

- `cookies()`, `headers()`, `params`, `searchParams` are async — always `await`.
- Middleware lives in `apps/web/src/proxy.ts` (Next 16 `proxy` convention).
- `revalidateTag(tag, profile)` needs its second argument; `next lint` is removed (lint runs via `bun run lint`).

## Conventions

- TypeScript strict, no `any`. Kebab-case file names; components PascalCase; hooks `use-*.ts`.
- API: thin controllers, logic in services, DTO validation at every boundary, guards on every private route, transactions around multi-step writes.
- Web: Server Components by default; loading/empty/error states for every data view; mobile-first at 375px.
- Comments explain "why", never "what".

## Database rules

- Drizzle schema first, then `bun run db:generate`. Migrations are additive, backward compatible, and the dependent code must work before they apply (`docs/ai/planning.md` "Migrations").
- The migration folder already has duplicate numeric prefixes (e.g. two `0018_*` files) — check before adding one.
- `db:reset`, `db:seed`, and any destructive statement need explicit user approval and never target a shared or production database.

## How agents operate

- Canonical flow, TDD, and routing live in `AGENTS.md`; phase rules in `docs/ai/{planning,execution,handoff}.md`.
- Never commit to `main`. One task = one branch + worktree from `origin/main` (`scripts/new-task-worktree.sh`), branch names `fix|feat|refactor|perf|infra|docs/<ticket|no-ticket>-<short-name>`. Existing branch families on the remote: `codex/*`, `feat/*`, `fix/*`, `infra/*`.
- Release: one PR into `main`, "Create a merge commit". Merging deploys production, so CI must be green (`gh pr checks <number>`) and the merge is the user's call.
- Worktrees share `.git`: never run bare `git stash` / `git stash pop`.

## Git remote

- `origin` must use the SSH alias `git@github.com-owlrepo:OwlRepo/<repo>.git` (key `~/.ssh/id_owlrepo`); check with `git remote get-url origin`.
- The plain `git@github.com:...` form authenticates as `romeo-tarraula` and is denied write access.
- If a push fails with permission denied: `git remote set-url origin "$(git remote get-url origin | sed 's#git@github.com:#git@github.com-owlrepo:#')"`.
- SSH config aliases live in `~/.ssh/config` (`Host github.com-owlrepo`). Run `gh auth switch --hostname github.com --user OwlRepo` before any `gh` command.

## Do not

- Install dependencies without asking; `bun install` only, never `npm install`.
- Edit generated files (`.claude/agents/*.md`) — edit `agents/src/*` and run `bun run agents:generate`.
- Touch `.github/workflows/deploy.yml` or Docker files without an INFRASTRUCTURE-routed, approved plan.
- Reintroduce the retired planner/executor handoff (`.ai-scratchpad.md`).
- Over-engineer: a table and a service beat a new microservice.
