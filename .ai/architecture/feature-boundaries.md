# Feature Boundaries

## Web Boundaries
- Route-level features live in `apps/web/src/app/(dashboard)/*` and dedicated route segments.
- Shared UI primitives must remain in `apps/web/src/components/ui` or `packages/ui`.
- Hooks in `apps/web/src/hooks` should stay framework-agnostic to page concerns when reusable.

## API Boundaries
- Each domain module owns its controller + service + module wiring.
- Cross-domain behavior should integrate via service injection, not controller coupling.
- Shared guards/utilities remain in `apps/api/src/common` and `apps/api/src/auth`.

## High-Risk Protected Zones
- Authentication/authorization (`apps/api/src/auth`, guards)
- Database schemas/migrations (`packages/database`)
- Global shared utilities (`apps/api/src/common`, shared libs)
- Billing/messaging/AI policy/webhook contracts
