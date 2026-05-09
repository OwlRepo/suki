# API Routes (NestJS Controllers)

## Discovery Method
Routes discovered from `@Controller` and HTTP decorators in `apps/api/src/**`.

## Core Route Groups (sampled high-traffic + high-risk)
- `GET /health`, `GET /health/feature-flags`, `GET /health/db`
- `POST /auth/sync`
- `GET /users/me/workspace`, `PATCH /users/me/workspace`
- `GET/PATCH /organizations/me`, `GET /organizations/me/recommendations`
- `GET/POST/PATCH/DELETE /customers*` (customers + templates + visits + message history)
- `GET/POST/PATCH /billing/*`, `POST /billing/webhook/paymongo`
- `GET/POST /messaging/*`, `POST /messaging/inbound/sms`, `POST /messaging/webhooks/*`
- `GET/PATCH /automation/settings`, `GET /automation/previews`
- `GET/POST/PATCH /appointments*`
- `GET/POST/PATCH /promos*`
- `GET/POST /crm/*` (deals, stages, tasks, activities, custom-fields)
- `POST/GET /imports/*` (parse, validate, commit, batches, rollback)
- `GET/PATCH/DELETE /privacy/*`
- `POST /licensing/*`, `GET /licensing/ota/*`
- `POST /ai/check`, `GET /ai/usage/*`, `PATCH /ai/usage/policies`
- `GET /intake/config`, `POST /intake`, `GET /intake/availability`, `POST /intake/hold`, `POST /intake/otp/send`, `POST /intake/otp/verify`

## Auth Requirements
- Most business routes are protected by `ClerkAuthGuard`.
- Additional guards enforce plan/billing/owner/crm-mode/founder controls by route.
- Intake endpoints are public-facing for external customers; server-side validation and business scoping are required for every request.

## Request/Response Schema Sources
- DTO/body/query declarations in controller signatures
- class-validator/class-transformer + ValidationPipe
- module-specific service return types
