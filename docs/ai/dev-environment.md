# Development Environment

> MAP, not proof — if this contradicts code, env files, or compose files, those win; fix this doc in the same change.

## Local stack

Two ways to run it (`README.md` "Developer Quick Context", root `package.json`):

- **Host processes:** `bun install`, then `bun run dev` (runs `db:setup`, then `turbo run dev`). Single app: `bun run dev:web` / `bun run dev:api`.
- **Docker:** `bun run docker:dev:up` → `docker-compose.yml`: `postgres` (PostgreSQL 16, host port `5433`, database `tyvera`), `api` (`3001`, `apps/api/Dockerfile` target `dev`), `web` (`3000`, `NEXT_PUBLIC_API_URL=http://localhost:3001`). Logs: `bun run docker:dev:logs`; stop: `bun run docker:dev:down`.

Environment variables come from `.env` (gitignored). Never print or commit secret values; list variable names only.

## Database lifecycle

Root scripts delegate to `packages/database` (`package.json`, `packages/database/package.json`):

| Script | What it does | Safe for task validation? |
|---|---|---|
| `bun run db:generate` | `drizzle-kit generate` from `packages/database/src/schema/index.ts` | yes (writes migration files) |
| `bun run db:migrate` | applies pending migrations (`scripts/migrate.ts`) | local database only |
| `bun run db:setup` | local setup (`scripts/setup.ts`) | local database only |
| `bun run db:seed` / `db:reset` | seed / reset | local only, and only with explicit user approval |
| `bun run db:studio` | Drizzle Studio | read-only use |

Never point a lifecycle script at a shared or production database from a task.

## Tests

- `bun run test` → `turbo run test` (vitest in `apps/web` and `apps/api`; `packages/types` runs via `bun run --cwd packages/types test:run`).
- Targeted: from the workspace, `../../node_modules/.bin/vitest run <file>`.
- Workflow scripts: `bun run test:scripts`.

## Production

A push to `main` runs `.github/workflows/deploy.yml`: SSH to the VPS (`~/apps/tyvera`), `git pull --ff-only`, `pg_dump` backup to `~/apps/tyvera-backups` (14-day retention), build `api` then `web` with `docker-compose.prod.yml`, start containers, health-check `http://localhost:3001/health` and `http://localhost:3000`, seed platform-admin RBAC, and smoke-check `https://tyvera.app/sign-up` for dev artifacts. The API container applies pending migrations on start (`apps/api/Dockerfile`). There is no staging environment; manual QA happens locally.

## Git hooks

`bun install` runs `prepare` → `husky`, which sets `core.hooksPath` to `.husky/_` (shared `.git` config, so it applies to every worktree). `.husky/pre-commit` runs `bun run agents:lint` when persona files are staged. The Claude Code PreToolUse hook (`.claude/settings.json` → `scripts/hooks/tdd-red-guard.mjs`) enforces RED-before-code for workspace `src/` logic.
