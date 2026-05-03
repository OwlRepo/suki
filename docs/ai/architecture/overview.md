Last updated: 2026-05-03T11:29:25.639Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Architecture Overview

Fullstack Bun/Turborepo monorepo:
- `apps/web`: Next.js 16 + React 19 frontend
- `apps/api`: NestJS 10 REST backend
- `packages/database`: Drizzle ORM + PostgreSQL tooling
- `packages/ui`, `packages/types`, `packages/config`: shared packages
