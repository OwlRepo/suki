# Module Structure

## Workspaces

| Workspace | Purpose |
|-----------|---------|
| apps/web | Next.js frontend |
| apps/api | NestJS backend |
| packages/ui | Shared React components |
| packages/database | Drizzle schema, migrations |
| packages/types | Shared TypeScript types |
| packages/config | Shared tsconfig |

## Module Organization

- **Frontend**: app/ (layout, page, providers)
- **Backend**: NestJS modules (health, etc.)
- **Shared**: packages/* for cross-app code
