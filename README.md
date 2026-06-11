# Tyvera

**Bring customers back automatically. No more forgotten follow-ups.**

---

## The Real Problem

Customers forget appointments. Staff forgets to follow up.  
Businesses lose repeat customers silently—and only notice when revenue drops.

Most of the time, it’s not bad service.

It’s just that **everyone forgets**.

---

## What Tyvera Does

Tyvera helps service businesses **recover lost customers automatically**.

It captures or reuses customer records during booking, records completed appointment visits automatically, and sends reminders and follow-ups at the right time—so customers come back without you needing to remember.

You don’t need to open it every day.  
You set it once. It runs for you.

---

## Current Product Capabilities

- Public intake page per business (`/intake/[businessId]`) for lead capture and booking requests
- Guided booking flow with date/time selection, review, and OTP verification
- Temporary slot holds before confirmation to reduce double-booking
- Appointment-first daily workflow: staff marks Arrived once; checked-in appointments complete automatically after the expected duration and grace period
- Customer records are created or reused during booking; completed appointments update visit history automatically
- Guided Facebook slot sharing flow with source tracking into customer notes
- Protected dashboard routes for internal staff flows (appointments, insights, settings, and related pages)
- Updated adaptive app shell and navigation for desktop + mobile dashboard use

---

## What Actually Changes

- Fewer empty slots from missed appointments  
- More repeat visits without manual follow-ups  
- Customers don’t drift away unnoticed  
- Less texting, less mental load  

---

## Automations That Run Automatically

| Automation | What it does | What you get |
|------------|--------------|--------------|
| Appointment reminders | Confirmation + reminder before visit | Fewer no-shows |
| Missed appointment recovery | “You missed—rebook here” | Recover lost bookings |
| Post-visit follow-up | Thank-you + rebook message | Increase repeat visits |
| Inactivity winback | “We miss you” after 30–60 days | Bring back inactive customers |

---

## Who This Is For

Tyvera is built for **service businesses with repeat customers**:

- Salons & barbershops  
- Clinics & dental clinics  
- Gyms & spas  
- Any business where customers come back regularly  

---

## Not For

- Cafes  
- Convenience stores  
- One-time transaction businesses  

If customers don’t come back regularly, Tyvera won’t add much value.

---

## 💰 Pricing (Early Access)

Tyvera is currently offered as a **customer follow-up automation service**.

You don’t pay for “software”—you pay for:
> **customers coming back automatically**

---

### Starter — ₱999/month

- Appointment-first booking workspace
- Automatic visit tracking from completed appointments
- Core automations:
  - Appointment reminders  
  - Missed appointment recovery  
  - Post-visit follow-ups  
- **300 SMS included**

**Extra usage:** ₱2.50 per SMS beyond 300  

---

### Growth — ₱2,499/month

Everything in Starter +

- Inactivity winback automation  
- New vs repeat customer insights  
- AI-assisted message writing  
- **800 SMS included**

**Extra usage:** ₱2.30 per SMS beyond 800  

---

### Pro — ₱5,999/month

Everything in Growth +

- Advanced segmentation  
- Month-to-month comparisons  
- Multi-branch ready  
- **2,000 SMS included**

**Extra usage:** ₱2.00 per SMS beyond 2,000  

---

### Example

If you’re on Starter:

- 300 SMS included  
- You used 500  

Billing:

- ₱999 base
- 200 extra × ₱2.50 = ₱500  

**Total: ₱1,499**

---

## 🧠 Why Businesses Use Tyvera

One recovered customer often covers the monthly cost.

Example:
- Missed appointment = ₱500–₱1,000 lost  
- Tyvera reminder = brings them back  

That’s already ROI.

---

## 🤝 Current Setup (Early Stage)

Tyvera is currently offered with **direct support and setup**.

- Setup is handled with you  
- Billing is sent monthly (GCash / bank transfer)  
- Usage is tracked and summarized clearly  

This allows faster onboarding and better results early on.

---

## 🔒 Your Data

- You own your customer data  
- Nothing is deleted if you stop  
- You can request export anytime  

---

## 🚀 Quick Start

Run locally:

```bash
bun run docker:dev:up
```

Runs:
- Postgres  
- API  
- Web (with hot reload)  

Requires [Docker](https://docs.docker.com/get-docker/)

## Auth Setup (Local First-Party Auth)

Tyvera now uses first-party auth with Resend email OTP and session cookies.

- Web auth pages: `/sign-in`, `/sign-up`
- API auth routes: `/auth/*`
- Required env keys:
  - `AUTH_SESSION_SECRET`
  - `AUTH_SESSION_TTL_DAYS`
  - `AUTH_OTP_TTL_MINUTES`
  - `AUTH_OTP_MAX_ATTEMPTS`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
- Optional startup bootstrap account (local/staging):
  - `AUTH_BOOTSTRAP_DEFAULT_ACCOUNT`
  - `AUTH_BOOTSTRAP_EMAIL`
  - `AUTH_BOOTSTRAP_PASSWORD`
  - `AUTH_BOOTSTRAP_ORG_NAME`

## SMS and OTP Provider Setup

Automated outbound SMS is selected explicitly with `SMS_PROVIDER`. Production should use Semaphore for automated messages:

```bash
SMS_PROVIDER=semaphore
SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=
SEMAPHORE_RECONCILIATION_ENABLED=true
SEMAPHORE_RECONCILIATION_CRON=*/5 * * * *
MANUAL_FOLLOW_UP_DIGEST_CRON=*/15 * * * *
```

Semaphore reconciliation polls recent accepted appointment SMS messages for delayed `Failed` or `Refunded` states. Those failures, plus immediate unconfirmed send failures, create owner-visible manual follow-up tasks at `/needs-attention`; digest emails include only a count and secure link, never customer details.

Booking OTP supports a transitional Twilio-to-Semaphore mode:

```bash
OTP_PROVIDER_MODE=auto
TWILIO_OTP_FAILOVER_ON_ERROR_CODES=
```

`auto` starts from persisted organization provider state, defaults to Twilio, and switches future OTP sends for that organization to Semaphore only after a Twilio error code listed in `TWILIO_OTP_FAILOVER_ON_ERROR_CODES`. Do not populate that allowlist with guessed codes.

For Twilio rollback, inbound STOP handling, delivery status callbacks, and transitional OTP, configure Twilio with exact public HTTPS URLs, including the `/api` prefix used by the production reverse proxy:

- Outbound sender: `TWILIO_MESSAGING_SERVICE_SID` preferred, or `TWILIO_PHONE_NUMBER`
- Status callback: `POST https://tyvera.app/api/messaging/webhooks/twilio/status`
- Incoming message webhook: `POST https://tyvera.app/api/messaging/inbound/sms`
- Transitional booking OTP: `TWILIO_VERIFY_SERVICE_SID`

Provider env:

```bash
SMS_PROVIDER=semaphore
SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=
SEMAPHORE_RECONCILIATION_ENABLED=true
SEMAPHORE_RECONCILIATION_CRON=*/5 * * * *
MANUAL_FOLLOW_UP_DIGEST_CRON=*/15 * * * *
OTP_PROVIDER_MODE=auto
TWILIO_OTP_FAILOVER_ON_ERROR_CODES=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_PHONE_NUMBER=
TWILIO_VERIFY_SERVICE_SID=
TWILIO_STATUS_CALLBACK_URL=https://tyvera.app/api/messaging/webhooks/twilio/status
TWILIO_INBOUND_SMS_WEBHOOK_URL=https://tyvera.app/api/messaging/inbound/sms
```

Trial Twilio accounts may only send to verified recipients. Confirm this before onboarding real customers.

## Platform Admin Production Setup

The platform-admin console uses the existing first-party auth session and `tyvera_session` cookie. Runtime authorization comes from database-backed platform-admin RBAC; founder allowlists remain bootstrap bridges only and should not be treated as normal production authorization.

Required production-ready platform-admin env keys:

```bash
FF_self_serve_billing_enabled=false
FF_manual_billing_controls_enabled=true
FF_founder_led_mode_enabled=true

PLATFORM_ADMIN_BOOTSTRAP_EMAIL=
PLATFORM_ADMIN_BOOTSTRAP_USER_ID=

MANUAL_PAYMENT_GCASH_NUMBER=
MANUAL_PAYMENT_GCASH_ACCOUNT_NAME=
MANUAL_PAYMENT_BANK_NAME=
MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER=
MANUAL_PAYMENT_BANK_ACCOUNT_NAME=

SEMAPHORE_RECONCILIATION_ENABLED=true
SEMAPHORE_CREDIT_WARNING_THRESHOLD=500
SEMAPHORE_CREDIT_CRITICAL_THRESHOLD=200
```

Leave payment account values blank in committed files. Set real GCash and bank details only in production environment storage; these values are rendered only inside platform-admin manual billing responses.

Founder-led manual billing through GCash or bank transfer is used during validation. Self-serve billing remains disabled until rollout approval.

One-time production bootstrap:

```bash
bun run db:migrate
bun run db:seed-platform-admin-rbac

PLATFORM_ADMIN_BOOTSTRAP_EMAIL=<existing-login-email> \
  bun run db:bootstrap-platform-admin
```

The bootstrap command promotes an existing Tyvera user to the seeded `FOUNDER` role. It does not create a password, login identity, or production credential.

Production rollout order:

1. Back up PostgreSQL.
2. Deploy application code.
3. Run `bun run db:migrate`.
4. Run `bun run db:seed-platform-admin-rbac`.
5. Bootstrap the existing founder account.
6. Sign in as founder.
7. Run `docs/platform-admin-production-smoke-test.md`.
8. Configure Better Stack manually.
9. Monitor logs, provider health, alerts, and communications.

Emergency rollback rules:

1. Stop using `/platform-admin`.
2. Roll back the application image.
3. Keep additive migrations unless they cause a confirmed issue.
4. Do not delete platform-admin tables during emergency rollback.
5. Restore PostgreSQL only if data corruption occurred.
6. Verify customer-facing `/admin/*` routes and messaging flows.

Better Stack and Sentry are not integrated in application code. Better Stack should be configured externally for uptime checks. Sentry is a future optional integration for `apps/web` and `apps/api`, scoped to unhandled frontend errors, NestJS exceptions, webhook-handler exceptions, scheduler exceptions, and Semaphore request failures. Do not capture OTP codes, full mobile numbers, full email bodies, payment-proof content, or provider API keys.

## Mobile Number Format

Tyvera requires Philippine mobile numbers in strict E.164 format anywhere a mobile value is provided:

```text
+639171234567
```

Customer mobile is optional, but any nonblank value must use this format. OTP and booking hold flows require a valid mobile number. Local formats like `09171234567`, `9171234567`, numbers with spaces/punctuation, and non-Philippine country codes are rejected.

Before broad OTP rollout, report and manually clean existing invalid records:

```sql
select id, name, mobile
from customers
where mobile is not null
  and mobile <> ''
  and mobile !~ '^\+639[0-9]{9}$';

select id, business_id, mobile, expires_at
from booking_holds
where mobile !~ '^\+639[0-9]{9}$';
```

---

## Developer Quick Context

- Monorepo: Bun + Turborepo
- Web: Next.js 16 + React 19 (`apps/web`)
- API: NestJS 10 (`apps/api`)
- Database: Drizzle schema/migrations (`packages/database`)

Common commands:

```bash
bun run dev
bun run test
bun run lint
bun run typecheck
bun run docker:dev:up
```

Targeted commands:

```bash
bun run dev:web
bun run dev:api
bun run --cwd apps/web test:run
bun run --cwd apps/api test:run
```

---

## 🧪 Status

- MVP ready  
- Core automations working  
- Intake booking holds with OTP verification live  
- Early users onboarding  

---

## 📬 Contact

For early access or setup:

→ Reach out directly
