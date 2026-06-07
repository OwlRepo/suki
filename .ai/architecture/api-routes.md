# API Routes (NestJS Controllers)

## Discovery Method
Routes discovered from `@Controller` and HTTP decorators in `apps/api/src/**`.

## Core Route Groups (sampled high-traffic + high-risk)
- `GET /health`, `GET /health/feature-flags`, `GET /health/db`
- `POST /auth/sync`, `POST /auth/sign-in/password`, `POST /auth/sign-up/start`, `POST /auth/sign-up/verify`, `POST /auth/password-reset/start`, `POST /auth/password-reset/verify`, `GET /auth/me`, `POST /auth/sign-out`
- `GET /users/me/workspace`, `PATCH /users/me/workspace`
- `GET/PATCH /organizations/me`, `GET /organizations/me/recommendations`
- `GET/POST/PATCH/DELETE /customers*` (customers + templates + visits + message history)
- `GET/POST/PATCH /billing/*`, `POST /billing/webhook/lemonsqueezy`
- `GET/POST /messaging/*`, `GET /messaging/email-usage`, `POST /messaging/inbound/sms`, `POST /messaging/webhooks/*`
- `GET/PATCH /automation/settings`, `GET /automation/previews`, `PATCH /automation/refine-message`
- `GET/POST/PATCH /appointments*` including `PATCH /appointments/:id/arrive` for staff arrival and `GET /appointments/needs-review` for overdue unchecked appointments
- `GET/POST/PATCH /promos*`
- `GET/POST /crm/*` (deals, stages, tasks, activities, custom-fields)
- `POST/GET /imports/*` (parse, validate, commit, batches, rollback)
- `GET/PATCH/DELETE /privacy/*`
- `POST /licensing/*`, `GET /licensing/ota/*`
- `POST /ai/check`, `GET /ai/usage/*`, `PATCH /ai/usage/policies`
- `POST /help/assistant/chat`, `POST /help/assistant/chat/stream`, `GET /help/answer-source/*`
- `GET /intake/config`, `POST /intake`, `GET /intake/availability`, `POST /intake/hold`, `POST /intake/otp/send`, `POST /intake/otp/verify`
- `GET /platform-admin/session`, `GET /platform-admin/organizations*`, `GET/POST /platform-admin/billing-requests*`, `POST /platform-admin/manual-payments/*`, `POST /platform-admin/organizations/:organizationId/sms-adjustments`, `GET /platform-admin/communications*`, `GET /platform-admin/automation-runs`, `GET /platform-admin/provider-health`, `GET/PATCH /platform-admin/alerts*`, `GET /platform-admin/audit-logs`

## Auth Requirements
- Most business routes are protected by `ClerkAuthGuard` (compatibility name for first-party session auth guard).
- Additional guards enforce plan/billing/owner/crm-mode/founder controls by route.
- Platform-admin routes are protected by `ClerkAuthGuard` plus `PlatformAdminGuard`; users must have an active `platform_admins` row and database-backed role permissions.
- Intake endpoints are public-facing for external customers; server-side validation and business scoping are required for every request.
- Public account creation is allowed through `/auth/sign-up/start` + `/auth/sign-up/verify`; verify accepts email, OTP code, and password, then creates the owner account and session.
- `POST /auth/sign-in/password` sets the session cookie on success and returns `{ ok: true, redirectTo }`, where `redirectTo` is `/onboarding` until user onboarding progress reaches `currentStep >= 7`, otherwise `/dashboard`.
- `GET /auth/me` returns `{ user }` when signed in, and the user payload now includes `id`, `email`, `role`, and `organizationId` so pricing and billing UI can distinguish owner vs staff behavior without a separate auth provider SDK.
- Public password reset is allowed through `/auth/password-reset/start` + `/auth/password-reset/verify`; start always returns `{ ok: true }` to avoid account enumeration, and verify accepts email, OTP code, and new password, then replaces the password hash, revokes old sessions, sets the session cookie, and returns `{ ok: true, redirectTo }`.

## Request/Response Schema Sources
- DTO/body/query declarations in controller signatures
- class-validator/class-transformer + ValidationPipe
- module-specific service return types

## Mobile Number Contract
- Tyvera currently accepts only Philippine mobile numbers in strict E.164 format: `+639171234567`.
- `POST /customers` and `PATCH /customers/:id` allow blank optional `mobile`, but reject any nonblank value that is not `+639` followed by 9 digits.
- `POST /customers/resolve-for-booking` reuses an exact normalized `(businessId, mobile)` match for authenticated booking flows without overwriting the existing customer profile.
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
- `POST /messaging/webhooks/resend` verifies Svix signatures, claims `processed_webhook_events` with `resend:<svix-id>`, ignores duplicate Svix deliveries, maps Resend delivery events into existing delivery statuses, and records failed handler attempts on the processed-event row.
- Production callback URL env values must include the externally visible `/api` prefix used by the reverse proxy.

## Billing Route Notes
- `GET /billing/plans` returns the canonical billing catalog used by both API and web pricing surfaces.
- `GET /billing/plans` also returns `checkoutEnabled` so Lemon-backed checkout can be disabled while the free-cap path stays live.
- `GET /billing/plans` also returns `annualCheckoutEnabled` so annual pricing can stay visible while self-serve annual checkout remains disabled.
- `GET /billing/status` returns current plan, lifecycle state, `cancellationPending`, scheduled downgrade fields, meter totals for verified-booking, SMS, email, and AI requests, plus explicit `ownerWarnings` and a `readOnly` flag for staff viewers.
- Web plan-capability helpers derive AI visibility from `GET /billing/status.planType`, so free/starter plans hide assistant, AI usage, analytics, and refine actions while growth/pro keep the current AI surfaces.
- `POST /billing/checkout` and `POST /billing/addons/checkout` only accept plan/interval or SKU identifiers; the server resolves Lemon Squeezy variants from an allowlist.
- `POST /billing/customer-portal`, `POST /billing/change-plan`, `POST /billing/cancel`, and `POST /billing/resume` are owner-only mutations.
- When `FF_self_serve_billing_enabled=false`, Lemon-backed billing mutations short-circuit with a stable disabled response and webhook delivery becomes a harmless no-op; the free-cap usage and billing-status surfaces still work.
- Billing lifecycle mutations are webhook-authority-only: `change-plan`, `cancel`, and `resume` persist pending-sync UX metadata and return `pendingWebhookSync: true`, while final subscription status, cancellation flags, renewal/end dates, org plan, and entitlements are updated only by verified Lemon webhook reconciliation.
- `GET /billing/status` is shared by owner and staff billing settings views; staff can read status but all billing mutations remain owner-only.
- `POST /billing/webhook/lemonsqueezy` verifies the raw-body HMAC signature before recording events idempotently, applying subscription/order reconciliation, marking unknown Lemon events as ignored no-ops, and persisting failed reconciliation rows with `failureReason` for audit/replay.
- `GET /billing/status` owner warnings are explicit API data, not inferred client-side: only unresolved `refund_review` rows surface a persistent warning and delayed webhook reconciliation surfaces `delayed_webhook_sync` while pending-sync metadata remains uncleared.

## Platform Admin Route Notes
- `GET /platform-admin/session` returns the active platform-admin row, role codes, and resolved permission codes for the signed-in first-party session.
- Authenticated non-platform users receive `403 Forbidden`; unauthenticated users are rejected by the first-party session guard before platform-admin authorization runs.
- PR2 manual billing routes reuse the same `/platform-admin/*` namespace and `PlatformAdminGuard`; permission decorators gate list/create/void/payment/audit endpoints and the service performs action-specific checks for promotional grants vs corrections.
- Manual billing request creation resolves SKUs from the canonical billing add-on catalog, snapshots purchase kind, units, quantity, PHP price, and a `TYV-YYYY-000001` reference number, then returns platform-admin-only payment instructions.
- Manual payment confirmation runs in one transaction, requires exact PHP amount match, checks existing fulfillments before grant, calls shared provider-neutral add-on grant services, inserts fulfillment rows, marks payment/request state, and writes platform-admin audit logs.
- SMS adjustments require a reason, write reconciliation/audit rows through the shared grant primitive, and reject negative corrections that would reduce remaining credits below zero.
- Communications monitoring routes (`GET /platform-admin/communications`, `/communications/summary`, and `/communications/:messageEventId`) require `COMMUNICATION_VIEW`, reuse existing `message_events` / usage / manual follow-up / public OTP records, mask recipient details, and do not expose full message content or raw provider metadata.
- Operations monitoring routes (`GET /platform-admin/automation-runs`, `GET /platform-admin/provider-health`, `GET /platform-admin/alerts`, and `PATCH /platform-admin/alerts/:alertId`) reuse the platform-admin namespace and guard; `AUTOMATION_RUN_VIEW` gates scheduler history, `ALERT_VIEW` gates provider/alert reads, and `ALERT_ACKNOWLEDGE` gates acknowledge/resolve actions.

## Public Intake OTP Notes
- Public intake submit reuses an existing customer by exact normalized business/mobile when available, and creates a new customer only when no safe mobile identity match exists.
- `POST /intake/otp/send` returns `success`, `reused`, `holdExpiresAt`, `resendAvailableAt`, and `sendsRemaining` so the public booking UI can render resend cooldowns and hold-expiry countdowns without guessing from client state.
- `POST /intake/otp/send` enforces resend cooldown per hold, max sends per hold, rolling per-mobile limits, rolling per-IP limits, and a per-business daily cap using env-driven thresholds; blocked sends record durable `public_otp_send_events.outcome` codes such as `OTP_RESEND_COOLDOWN`, `OTP_HOLD_SEND_LIMIT`, `OTP_MOBILE_RATE_LIMIT`, `OTP_IP_RATE_LIMIT`, `OTP_BUSINESS_DAILY_LIMIT`, `OTP_BILLING_BLOCKED`, and `OTP_PROVIDER_UNAVAILABLE` once hold/business/org/mobile context is known.
- `POST /intake/otp/verify` keeps the endpoint public, but the UI should treat returned OTP error codes as customer-safe states (`OTP_INVALID_CODE`, `OTP_MAX_ATTEMPTS`, `OTP_HOLD_EXPIRED`, `OTP_SLOT_CONFLICT`, `OTP_PROVIDER_UNAVAILABLE`) rather than surfacing raw provider or billing internals.
- Operator note: unresolved refund-review warnings require manual follow-up, duplicate Lemon webhook replay is safe, and self-serve annual checkout remains visible-but-disabled until `FF_annual_billing_checkout_enabled=true`.
