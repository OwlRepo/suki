# Technology Stack

## Summary

| Layer | Technology |
|-------|------------|
| Package Manager | Bun |
| Language | TypeScript 5 |
| Frontend | Next.js 16, React 19 |
| Styling | Tailwind CSS 4 |
| Auth | Clerk |
| Backend | NestJS 10, Express |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Build | Turborepo |

## Frontend

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19
- **Styling**: Tailwind CSS 4, PostCSS
- **Auth**: @clerk/nextjs
- **Components**: @suki/ui
- **Data**: Server Components, native fetch (no TanStack Query yet)

## Backend

- **Runtime**: Node.js 18+
- **Framework**: NestJS 10
- **Platform**: Express
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Config**: @nestjs/config, dotenv

## Shared Packages

- **@suki/ui**: React components (Button, Card, Input, Modal, EmptyState, ConfirmDialog)
- **@suki/database**: Drizzle schema, migrations, getDb()
- **@suki/types**: Shared types (Plan, Organization, Business, User, Customer, etc.)
- **@suki/config**: Shared tsconfig

## Environment Variables

See `.env.example` for required variables (DATABASE_URL, Clerk keys, etc.).
