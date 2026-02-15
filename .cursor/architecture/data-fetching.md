# Data Fetching

## Current Patterns

- **Server Components**: Default in Next.js App Router; fetch on server
- **Client Components**: Use native `fetch` or `useEffect` + fetch
- **No TanStack Query/SWR yet**: Add when needed for caching/mutations

## Conventions

- Fetch from NestJS API at `/api/...` (or configured API URL)
- Use Server Components for initial data when possible
- Client components: fetch in useEffect or event handlers
