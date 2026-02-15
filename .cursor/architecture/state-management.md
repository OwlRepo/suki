# State Management

## Current State

- **Auth**: Clerk manages authentication state (ClerkProvider in providers.tsx)
- **No global state**: No Redux, Zustand, or Pinia yet

## Future Patterns

When adding global state:
- Prefer Zustand for simplicity
- Use React Context for feature-scoped state
- Keep server state in Server Components where possible
