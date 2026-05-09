# Tech Stack

## Project Type
- Fullstack web platform (frontend + backend API)
- Monorepo workspace

## Languages
- TypeScript (primary)
- SQL migrations (Drizzle)
- Shell scripts (ops)

## Runtime / Package Manager
- Bun (`packageManager: bun@1.0.0`)
- Node.js compatible runtime (`engines.node >=18`)

## Frameworks
- Frontend: Next.js 16, React 19
- Backend: NestJS 10
- API auth SDK: Clerk

## Data / ORM
- `@suki/database` workspace package
- Drizzle migrations under `packages/database/drizzle`

## Testing
- Unit/integration: Vitest (web + api)
- E2E: Cypress (web)

## Tooling
- Monorepo orchestration: Turbo
- Linting: ESLint
- Type checking: TypeScript (`tsc --noEmit`)
- Containerization: Docker / docker-compose
- CI/CD: GitHub Actions (`.github/workflows/deploy.yml`)
