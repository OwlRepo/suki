Last updated: 2026-05-09T12:07:06.828Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo |
| Package manager/runtime | Bun 1.x |
| Frontend | Next.js 16.1.6, React 19.2.3, Tailwind CSS v4 |
| Backend | NestJS 10, Node runtime |
| ORM/DB | Drizzle ORM, PostgreSQL |
| Auth | Clerk (`@clerk/nextjs`, `@clerk/backend`) |
| Unit/Integration tests | Vitest |
| E2E tests | Cypress |
| CI/CD | GitHub Actions deploy workflow |
| Containers | Docker + docker compose |
