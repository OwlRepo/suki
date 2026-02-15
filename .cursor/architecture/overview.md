# System Architecture Overview

## Project Type

**Suki** is a full-stack monorepo built with Turborepo.

- **Frontend**: Next.js 16 (App Router), React 19
- **Backend**: NestJS 10, Express
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Clerk

## Application Flow

```mermaid
flowchart LR
    subgraph frontend [Frontend - apps/web]
        Next[Next.js 16]
        React[React 19]
        Clerk[Clerk Auth]
        UI[suki/ui]
        Next --> React
        Next --> Clerk
        Next --> UI
    end

    subgraph backend [Backend - apps/api]
        Nest[NestJS]
        Controllers[Controllers]
        Nest --> Controllers
    end

    subgraph data [Data Layer]
        DB[(PostgreSQL)]
        Drizzle[Drizzle ORM]
        DB --> Drizzle
    end

    subgraph packages [Shared Packages]
        Types[suki/types]
        Database[suki/database]
        UI
    end

    frontend -->|REST API| backend
    backend --> Database
    Database --> DB
    frontend --> Types
```

## Module Relationships

```mermaid
flowchart TB
    subgraph apps [Apps]
        Web[apps/web]
        Api[apps/api]
    end

    subgraph packages [Packages]
        UI[packages/ui]
        DB[packages/database]
        Types[packages/types]
        Config[packages/config]
    end

    Web --> UI
    Web --> DB
    Web --> Types
    Api --> DB
    Api --> Types
    UI --> Types
    DB --> Types
```

## Directory Structure

```
suki/
├── apps/
│   ├── web/          # Next.js frontend
│   │   └── src/
│   │       └── app/   # App Router
│   └── api/          # NestJS backend
│       └── src/
├── packages/
│   ├── ui/           # Shared React components
│   ├── database/     # Drizzle schema, migrations
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared TS config
├── turbo.json
└── package.json
```

## Key Architectural Decisions

1. **Monorepo**: Turborepo for build orchestration and shared packages
2. **Workspace packages**: @suki/ui, @suki/database, @suki/types used by both apps
3. **Database sharing**: Single @suki/database package with Drizzle schema
4. **Auth**: Clerk for frontend auth; backend validates tokens
5. **Type safety**: Shared @suki/types across frontend and backend
