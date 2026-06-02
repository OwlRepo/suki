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

It captures your customers, tracks visits, and sends reminders and follow-ups at the right time—so customers come back without you needing to remember.

You don’t need to open it every day.  
You set it once. It runs for you.

---

## Current Product Capabilities

- Public intake page per business (`/intake/[businessId]`) for lead capture and booking requests
- Guided booking flow with date/time selection, review, and OTP verification
- Temporary slot holds before confirmation to reduce double-booking
- Guided Facebook slot sharing flow with source tracking into customer notes
- Protected dashboard routes for internal staff flows (customers, appointments, insights, settings, and related pages)
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

### Starter — ₱299/month

- Customer list (QR signup + manual entry)  
- Visit tracking  
- Core automations:
  - Appointment reminders  
  - Missed appointment recovery  
  - Post-visit follow-ups  
- **300 SMS included**

**Extra usage:** ₱2.50 per SMS beyond 300  

---

### Growth — ₱799/month

Everything in Starter +

- Inactivity winback automation  
- New vs repeat customer insights  
- AI-assisted message writing  
- **800 SMS included**

**Extra usage:** ₱2.30 per SMS beyond 800  

---

### Pro — ₱1,499/month

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

- ₱299 base  
- 200 extra × ₱2.50 = ₱500  

**Total: ₱799**

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

## Twilio Setup

For production SMS, configure Twilio with exact public HTTPS URLs, including the `/api` prefix used by the production reverse proxy:

- Outbound sender: `TWILIO_MESSAGING_SERVICE_SID` preferred, or `TWILIO_PHONE_NUMBER`
- Status callback: `POST https://tyvera.app/api/messaging/webhooks/twilio/status`
- Incoming message webhook: `POST https://tyvera.app/api/messaging/inbound/sms`
- Booking OTP: `TWILIO_VERIFY_SERVICE_SID`

Required production env:

```bash
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_PHONE_NUMBER=
TWILIO_VERIFY_SERVICE_SID=
TWILIO_STATUS_CALLBACK_URL=https://tyvera.app/api/messaging/webhooks/twilio/status
TWILIO_INBOUND_SMS_WEBHOOK_URL=https://tyvera.app/api/messaging/inbound/sms
```

Trial Twilio accounts may only send to verified recipients. Confirm this before onboarding real customers.

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
