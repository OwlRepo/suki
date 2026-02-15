# Routing

## Next.js App Router

The frontend uses Next.js 16 App Router (file-based routing).

## Structure

- `apps/web/src/app/layout.tsx` - Root layout
- `apps/web/src/app/page.tsx` - Home page (/`)
- `apps/web/src/app/providers.tsx` - Client providers (Clerk)

## Conventions

- Routes are defined by `page.tsx` in `app/` directory
- `layout.tsx` wraps nested routes
- Client components use "use client" directive (e.g. providers.tsx)

## Auth Flow

ClerkProvider wraps the app in providers.tsx. Auth state is managed by Clerk.
