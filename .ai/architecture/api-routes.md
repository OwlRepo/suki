# API Routes (NestJS Controllers)

## Discovery Method
Routes discovered from `@Controller` and HTTP decorators in `apps/api/src/**`.

## Core Route Groups (sampled high-traffic + high-risk)
- `GET /health`, `GET /health/feature-flags`, `GET /health/db`
- `POST /auth/sync`, `POST /auth/sign-in/start`, `POST /auth/sign-in/verify`, `POST /auth/sign-in/password`, `POST /auth/password/set`, `POST /auth/sign-up/start`, `POST /auth/sign-up/verify`, `GET /auth/me`, `POST /auth/sign-out`
- `GET /users/me/workspace`, `PATCH /users/me/workspace`
- `GET/PATCH /organizations/me`, `GET /organizations/me/recommendations`
- `GET/POST/PATCH/DELETE /customers*` (customers + templates + visits + message history)
- `GET/POST/PATCH /billing/*`, `POST /billing/webhook/paymongo`
- `GET/POST /messaging/*`, `GET /messaging/email-usage`, `POST /messaging/inbound/sms`, `POST /messaging/webhooks/*`
- `GET/PATCH /automation/settings`, `GET /automation/previews`, `PATCH /automation/refine-message`
- `GET/POST/PATCH /appointments*`
- `GET/POST/PATCH /promos*`
- `GET/POST /crm/*` (deals, stages, tasks, activities, custom-fields)
- `POST/GET /imports/*` (parse, validate, commit, batches, rollback)
- `GET/PATCH/DELETE /privacy/*`
- `POST /licensing/*`, `GET /licensing/ota/*`
- `POST /ai/check`, `GET /ai/usage/*`, `PATCH /ai/usage/policies`
- `POST /help/assistant/chat`, `POST /help/assistant/chat/stream`, `GET /help/answer-source/*`
- `GET /intake/config`, `POST /intake`, `GET /intake/availability`, `POST /intake/hold`, `POST /intake/otp/send`, `POST /intake/otp/verify`

## Auth Requirements
- Most business routes are protected by `ClerkAuthGuard` (compatibility name for first-party session auth guard).
- Additional guards enforce plan/billing/owner/crm-mode/founder controls by route.
- Intake endpoints are public-facing for external customers; server-side validation and business scoping are required for every request.

## Request/Response Schema Sources
- DTO/body/query declarations in controller signatures
- class-validator/class-transformer + ValidationPipe
- module-specific service return types

## Assistant Route Notes
- `POST /help/assistant/chat/stream` is the primary path and emits SSE event phases (`meta`, `state`, `stage`, `delta`, `actions`, `done`, `error`) while sharing the same orchestration core as `/help/assistant/chat`.
- Assistant orchestration enforces canonical intent-tool contracts before release of user-visible payloads.
