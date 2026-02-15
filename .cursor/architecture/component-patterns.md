# Component Patterns

## Framework

- React 19
- TypeScript
- Tailwind CSS 4

## Shared Components (@suki/ui)

Use workspace package: `@suki/ui`

- **Button**: Primary UI button
- **Card**: Content container
- **Input**: Form input
- **Modal**: Dialog overlay
- **EmptyState**: Empty list placeholder
- **ConfirmDialog**: Confirmation dialog

## Import Pattern

```tsx
import { Button, Card, Input } from "@suki/ui";
```

## Conventions

- Use Tailwind for styling
- Keep components in @suki/ui for reuse; app-specific components in apps/web
- Client components need "use client" directive
