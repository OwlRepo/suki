# Database

## Stack

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Location**: packages/database

## Schema

Tables: organizations, businesses, users, customers, promos, appointments, subscriptions, ai_credits

## Migrations

```bash
bun run db:generate   # Generate migrations
bun run db:migrate    # Apply migrations
bun run db:studio    # Drizzle Studio
```

## Usage

```ts
import { getDb } from "@suki/database";
const db = getDb();
```
