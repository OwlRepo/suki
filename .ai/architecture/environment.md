# Environment Configuration

## Core Variables (by usage)
- Auth: Clerk keys/tokens (web + api auth flows)
- Database: connection variables used by `@tyvera/database`
- Billing: Lemon Squeezy API/store/webhook secrets, allowlisted variant ids, and rollout flags
- Manual billing: platform-admin-only payment instruction variables for GCash and bank transfer copy
- Messaging: Twilio SID/token, sender config, Verify Service SID, exact public inbound/status callback URLs, and Resend API key
- Provider monitoring: `SEMAPHORE_API_KEY`, `SEMAPHORE_CREDIT_WARNING_THRESHOLD`, `SEMAPHORE_CREDIT_CRITICAL_THRESHOLD`, and `SEMAPHORE_RECONCILIATION_ENABLED` control Semaphore health snapshots and missing-run alerts
- Messaging smoke (optional): `SMOKE_REAL_PROVIDERS`, `SMOKE_TWILIO_TO`, `SMOKE_RESEND_TO`
- AI: OpenAI keys and policy-related settings
- App runtime: `NODE_ENV`, app URLs, tenant/business context flags
- Platform-admin bootstrap: `PLATFORM_ADMIN_BOOTSTRAP_EMAIL` or `PLATFORM_ADMIN_BOOTSTRAP_USER_ID` promote an existing user only after RBAC seed has run
- Platform-admin release mode: keep `FF_self_serve_billing_enabled=false`, `FF_manual_billing_controls_enabled=true`, and `FF_founder_led_mode_enabled=true` for founder-led manual billing rollout
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
- Platform-admin bootstrap variables must never create production credentials or passwords; use them only to assign the seeded `FOUNDER` role to an existing user.
- `MANUAL_PAYMENT_GCASH_NUMBER`, `MANUAL_PAYMENT_GCASH_ACCOUNT_NAME`, `MANUAL_PAYMENT_BANK_NAME`, `MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER`, and `MANUAL_PAYMENT_BANK_ACCOUNT_NAME` are rendered only inside platform-admin manual billing responses and must not be exposed on public/customer pages.
- `SEMAPHORE_CREDIT_WARNING_THRESHOLD` defaults to 500 and `SEMAPHORE_CREDIT_CRITICAL_THRESHOLD` defaults to 200 when unset; provider-health snapshots and low-credit alerts must never expose the API key.
- Production platform-admin rollout should run `bun run db:migrate`, `bun run db:seed-platform-admin-rbac`, then `PLATFORM_ADMIN_BOOTSTRAP_EMAIL=<existing-login-email> bun run db:bootstrap-platform-admin`; the bootstrap promotes an existing user only.
