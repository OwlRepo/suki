Last updated: 2026-05-09T12:07:06.828Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Dev Commands

## Core Commands

| Scope | Capability | Command |
|---|---|---|
| root | install | `bun install` |
| root | dev (all) | `bun run dev` |
| root | build (all) | `bun run build` |
| root | typecheck (all) | `bun run typecheck` |
| root | lint (all) | `bun run lint` |
| root | test (all) | `bun run test` |
| root | e2e | `bun run test:e2e` |
| root | db:setup | `bun run db:setup` |
| root | db:migrate | `bun run db:migrate` |
| root | db:generate | `bun run db:generate` |

## Operational Commands

| Scope | Capability | Command |
|---|---|---|
| root | dev:web | `bun run dev:web` |
| root | dev:api | `bun run dev:api` |
| root | build:web | `bun run build:web` |
| root | build:api | `bun run build:api` |
| root | clean | `bun run clean` |
| root | db:studio | `bun run db:studio` |
| root | db:seed | `bun run db:seed` |
| root | db:reset | `bun run db:reset` |
| root | db:reconcile-orphans | `bun run db:reconcile-orphans` |
| root | refresh AI indexes metadata | `bun run update:ai-indexes` |
| root | docker dev up | `bun run docker:dev:up` |
| root | docker dev build | `bun run docker:dev:build` |
| root | docker dev down | `bun run docker:dev:down` |
| root | docker dev logs | `bun run docker:dev:logs` |
| root | docker prod build | `bun run docker:prod:build` |
| root | docker prod up | `bun run docker:prod:up` |
| root | push API image | `bun run push:api:acr` |

## Workspace-Level Commands

| Scope | Capability | Command |
|---|---|---|
| `apps/web` | run e2e interactively | `bun run --cwd apps/web test:e2e:open` |
| `apps/web` | start prod server | `bun run --cwd apps/web start` |
| `apps/api` | start built API | `bun run --cwd apps/api start` |
| `apps/api` | start built API prod mode | `bun run --cwd apps/api start:prod` |

## Not Detected
- format script (root)
- test:watch script (root)
