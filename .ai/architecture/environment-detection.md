# Environment Detection

## Detected Project Shape
- Type: Fullstack monorepo
- Workspace manager: Bun workspaces (`apps/*`, `packages/*`)
- Build orchestration: Turbo (`turbo.json`)

## Runtime Detection
- Bun: required and primary package manager
- Node: supported runtime target for built apps
- Python/Java/Go/Rust: not detected as primary project runtimes

## Framework Detection
- Next.js 16 (`apps/web`)
- React 19 (`apps/web`)
- NestJS 10 (`apps/api`)

## Build System Detection
- Next build pipeline (`next build --webpack`)
- Nest build (`nest build`)
- Turbo task graph across workspaces

## Testing Framework Detection
- Vitest (`apps/web`, `apps/api`)
- Cypress (`apps/web` e2e)

## Lint/Format Detection
- ESLint in web and api
- TypeScript type checking in web/api
- Prettier/Biome not detected as canonical scripts

## Container / CI
- Docker + docker-compose files present
- GitHub Actions deploy workflow detected; VPS deploy allows cold Docker rebuilds with a 35-minute job timeout and 30-minute SSH command timeout, and removes legacy Compose containers without deleting volumes before starting the renamed project

## Environment Files
- `.env`
- `.env.example`
