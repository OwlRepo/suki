# API Routes (NestJS Controllers)

## Discovery Method
Routes discovered from `@Controller` and HTTP decorators in `apps/api/src/**`.

## Core Route Groups (sampled high-traffic + high-risk)
- `GET /health`, `GET /health/feature-flags`, `GET /health/db`
- `POST /auth/sync`, `POST /auth/sign-in/password`, `POST /auth/sign-up/start`, `POST /auth/sign-up/verify`, `POST /auth/password-reset/start`, `POST /auth/password-reset/verify`, `GET /auth/me`, `POST /auth/sign-out`
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
- Public account creation is allowed through `/auth/sign-up/start` + `/auth/sign-up/verify`; verify accepts email, OTP code, and password, then creates the owner account and session.
- `POST /auth/sign-in/password` sets the session cookie on success and returns `{ ok: true, redirectTo }`, where `redirectTo` is `/onboarding` until user onboarding progress reaches `currentStep >= 7`, otherwise `/dashboard`.
- Public password reset is allowed through `/auth/password-reset/start` + `/auth/password-reset/verify`; start always returns `{ ok: true }` to avoid account enumeration, and verify accepts email, OTP code, and new password, then replaces the password hash, revokes old sessions, sets the session cookie, and returns `{ ok: true, redirectTo }`.

## Request/Response Schema Sources
- DTO/body/query declarations in controller signatures
- class-validator/class-transformer + ValidationPipe
- module-specific service return types

## Mobile Number Contract
- Tyvera currently accepts only Philippine mobile numbers in strict E.164 format: `+639171234567`.
- `POST /customers` and `PATCH /customers/:id` allow blank optional `mobile`, but reject any nonblank value that is not `+639` followed by 9 digits.
- `POST /intake` allows blank optional `mobile`, but rejects invalid nonblank values before persistence.
- `POST /intake/hold` and `POST /appointments/booking/hold` require a valid `+639...` mobile because the value feeds OTP/Twilio flows.
- `POST/GET /imports/*` validation and commit reject invalid nonblank mobile values; accepted imports persist normalized `+639...` values only.
- Local formats (`09171234567`, `9171234567`), spaces, punctuation, and non-Philippine country codes are rejected instead of silently rewritten.

## Assistant Route Notes
- `POST /help/assistant/chat/stream` is the primary path and emits SSE event phases (`meta`, `state`, `stage`, `delta`, `actions`, `done`, `error`) while sharing the same orchestration core as `/help/assistant/chat`.
- Assistant orchestration enforces canonical intent-tool contracts before release of user-visible payloads.

## Messaging Webhook Notes
- `POST /messaging/inbound/sms` is a Twilio-facing form webhook. It validates `X-Twilio-Signature` against `TWILIO_INBOUND_SMS_WEBHOOK_URL`, applies STOP opt-outs, and returns empty TwiML XML.
- `POST /messaging/webhooks/twilio/status` validates `X-Twilio-Signature` against `TWILIO_STATUS_CALLBACK_URL` before trusted delivery-state updates.
- Production callback URL env values must include the externally visible `/api` prefix used by the reverse proxy.
