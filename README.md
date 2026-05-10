# Suki

**Bring customers back automatically. No more forgotten follow-ups.**

---

## The Real Problem

Customers forget appointments. Staff forgets to follow up.  
Businesses lose repeat customers silently—and only notice when revenue drops.

Most of the time, it’s not bad service.

It’s just that **everyone forgets**.

---

## What Suki Does

Suki helps service businesses **recover lost customers automatically**.

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

Suki is built for **service businesses with repeat customers**:

- Salons & barbershops  
- Clinics & dental clinics  
- Gyms & spas  
- Any business where customers come back regularly  

---

## Not For

- Cafes  
- Convenience stores  
- One-time transaction businesses  

If customers don’t come back regularly, Suki won’t add much value.

---

## 💰 Pricing (Early Access)

Suki is currently offered as a **customer follow-up automation service**.

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

## 🧠 Why Businesses Use Suki

One recovered customer often covers the monthly cost.

Example:
- Missed appointment = ₱500–₱1,000 lost  
- Suki reminder = brings them back  

That’s already ROI.

---

## 🤝 Current Setup (Early Stage)

Suki is currently offered with **direct support and setup**.

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

Suki now uses first-party auth with Resend email OTP and session cookies.

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
