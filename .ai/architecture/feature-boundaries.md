# Feature Boundaries

## Web Boundaries
- Route-level features live in `apps/web/src/app/(dashboard)/*` and dedicated route segments.
- The dashboard is appointment-first: `/appointments` owns staff arrival, Needs Review, booking, and visit-completion state; `/customers` remains protected but redirects to `/appointments`.
- Public intake booking UX lives under `apps/web/src/app/intake/[businessId]` and should remain isolated from dashboard-only state.
- Shared UI primitives must remain in `apps/web/src/components/ui` or `packages/ui`.
- Hooks in `apps/web/src/hooks` should stay framework-agnostic to page concerns when reusable.
- Route access policy is centralized in `apps/web/src/proxy.ts` + `apps/web/src/lib/protected-routes.ts`.

## API Boundaries
- Each domain module owns its controller + service + module wiring.
- Cross-domain behavior should integrate via service injection, not controller coupling.
- Appointment lifecycle state belongs to `apps/api/src/appointments/*`; appointment completion is the idempotency boundary for customer visit counters and post-visit/loyalty side effects.
- Customer identity reuse belongs to `CustomersService` and matches exact normalized `(businessId, mobile)` with an advisory lock; do not add a uniqueness constraint until legacy duplicates are reconciled.
- Assistant model execution belongs to `apps/api/src/help/*` and must pass through `AiExecutionService` guardrails. Native streaming and tools remain independently disabled by default through centralized feature-flag methods, with the deterministic assistant flow retained as the rollback path.
- Assistant tools must use authenticated server tenant scope. The tools rollout includes aggregate reads, five-row masked customer lookup, ten-row minimal appointment lookup, and immutable draft text that is never saved or sent. Mutation registration is split from reads, remains disabled by tracked default, and is limited to customer profile updates and appointment rescheduling through signed short-lived proposals, explicit authenticated confirmation, read-only checks, stale-state checks, tenant/business scope checks, and idempotent already-applied handling.
- Do not add assistant delete, send, billing, authentication, appointment-status, visit-recording, or other irreversible/high-impact tools without a separate approval and safety design.
- Shared guards/utilities remain in `apps/api/src/common` and `apps/api/src/auth`.
- Intake booking hold + OTP confirmation behavior belongs to `apps/api/src/intake/*` and persists hold state via `packages/database` schema.
- Founder-led manual subscription request, fulfillment, billing-contact, lifecycle, billing-email attempt history, resend, and validation-stage Pro Forma Invoice behavior belongs to `apps/api/src/platform-admin/*`. Messaging providers own transport behind the exported `EMAIL_PROVIDER`; customer automation `message_events` do not own platform-admin billing-email attempts. Provider-managed Lemon Squeezy checkout and webhook lifecycle authority remain isolated in `apps/api/src/billing/*`; manual fulfillment must never overwrite a Lemon Squeezy subscription row.

## High-Risk Protected Zones
- Authentication/authorization (`apps/api/src/auth`, guards)
- Database schemas/migrations (`packages/database`)
- Global shared utilities (`apps/api/src/common`, shared libs)
- Billing/messaging/AI policy/webhook contracts
