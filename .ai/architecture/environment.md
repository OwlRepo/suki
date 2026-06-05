# Environment Configuration

## Core Variables (by usage)
- Auth: Clerk keys/tokens (web + api auth flows)
- Database: connection variables used by `@tyvera/database`
- Billing: Lemon Squeezy API/store/webhook secrets, allowlisted variant ids, and rollout flags
- Messaging: Twilio SID/token, sender config, Verify Service SID, exact public inbound/status callback URLs, and Resend API key
- Messaging smoke (optional): `SMOKE_REAL_PROVIDERS`, `SMOKE_TWILIO_TO`, `SMOKE_RESEND_TO`
- AI: OpenAI keys and policy-related settings
- App runtime: `NODE_ENV`, app URLs, tenant/business context flags
- Web API base: `NEXT_PUBLIC_API_URL` overrides browser API routing; production defaults to same-origin `/api`, development defaults to `http://localhost:3001`

## Source Files
- `.env` (local runtime)
- `.env.example` (documented baseline)

## Safety
- Never commit real secrets.
- Validate required vars at startup where possible.
- Treat auth/billing/ai env changes as high risk.
- `FF_self_serve_billing_enabled=false` keeps Lemon Squeezy checkout/portal/mutation/webhook paths inert while preserving free-cap operation, billing status, and usage meters.
- `FF_self_serve_billing_enabled=true` requires valid `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, and `LEMONSQUEEZY_WEBHOOK_SECRET`.
- `FF_annual_billing_checkout_enabled` only has effect when self-serve billing is enabled.
- `FF_appointment_visit_automation_enabled=true` enables the appointment lifecycle scheduler that auto-completes checked-in appointments and moves overdue unchecked appointments to Needs Review; keep unset/false in production until the lifecycle migration is applied.
- `BILLING_GROWTH_VERIFIED_BOOKINGS_PER_MONTH` must be a positive integer when set.
- Twilio production webhooks require `TWILIO_STATUS_CALLBACK_URL` and `TWILIO_INBOUND_SMS_WEBHOOK_URL` to match the exact public HTTPS URLs, including `/api` when routed through the production proxy.
- Startup warnings must never print Twilio auth tokens or other secret values.
