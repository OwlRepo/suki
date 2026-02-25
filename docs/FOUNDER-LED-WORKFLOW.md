# Founder-Led Workflow Guide

A practical guide for managing Suki when running in **founder-led, invite-only, manual billing mode**. Use this when coordinating with clients from acquisition through ongoing access management.

---

## 1. Overview

In founder-led mode:

- **No public sign-up** — New users cannot self-register. They must be provisioned by you.
- **No in-app checkout** — Billing, plans, and trial periods are controlled manually.
- **Invite-only access** — Users see "Request access" instead of "Try Suki Free."
- **Manual trial and billing** — You assign plans, extend trials, and manage status via the founder controls.

**Plans** (Basic / Grow / Pro) are internal entitlements only — they gate features but are not purchased in-app.

---

## 2. Prerequisites

### Environment Variables

Add to your root `.env`:

```bash
# Founder allowlist — who can use the Founder Billing Controls in Settings
FOUNDER_ALLOWLIST_EMAILS=you@example.com
FOUNDER_ALLOWLIST_USER_IDS=user_xxxxxxxxx

# Optional: where "Request access" links point (mailto or URL)
NEXT_PUBLIC_REQUEST_ACCESS_URL=mailto:hello@yourdomain.com?subject=Request%20access%20to%20Suki
```

- **FOUNDER_ALLOWLIST_EMAILS** — Comma-separated emails (e.g. `founder@example.com,admin@example.com`). Case-insensitive.
- **FOUNDER_ALLOWLIST_USER_IDS** — Comma-separated Clerk user IDs (e.g. `user_2abc,user_2xyz`). Find in [Clerk Dashboard → Users](https://dashboard.clerk.com).

If both lists are empty, no one can access founder billing controls (endpoints return 403).

### Feature Flags (Defaults)

| Flag | Default | Purpose |
|------|---------|---------|
| `FF_founder_led_mode_enabled` | `true` | Master switch for founder-led mode |
| `FF_public_signup_enabled` | `false` | If `true`, allows self-signup (use only for testing) |
| `FF_self_serve_billing_enabled` | `false` | If `true`, shows checkout/purchase UI |
| `FF_manual_billing_controls_enabled` | `true` | If `true`, founders see billing controls in Settings |

---

## 3. Acquisition Flow

### What Clients See

1. **Landing page** — "Request access" button (links to mailto or `NEXT_PUBLIC_REQUEST_ACCESS_URL`), "Sign in" for existing users.
2. **Sign-up page** (`/sign-up`) — Shows "Invite-only access. Contact us to get started." with a sign-in link. No Clerk sign-up form.
3. **Sign-in** — Clerk sign-in form works; users can log in if they have an account.

### What Happens When an Unprovisioned User Signs In

- User authenticates with Clerk successfully.
- App calls `POST /auth/sync` to sync user + org.
- User is not in `users` table → API returns **403** with message: "Access is invite-only. Contact us to get started."
- Dashboard shows that message and a Retry button; user cannot access the product.

**Action required:** Provision the user (see Section 4).

---

## 4. Provisioning New Users (Invite Flow)

There is no automated invite system. You provision users by inserting records into the database.

### Step 1: Get the Client's Clerk User ID

1. Ask the client to sign up at [Clerk Dashboard](https://dashboard.clerk.com) or use your existing Clerk instance.
2. In Clerk Dashboard → Users, find the user and copy their **User ID** (e.g. `user_39zPGyCMkSbiF1AdE2Lqi2zlIWS`).

Alternatively, if you temporarily enable `FF_public_signup_enabled=true`, the client can self-signup; their user will be created on first sync. Then set the flag back to `false`. This is a quick option for testing.

### Step 2: Insert Records into the Database

Run SQL (or use a script) to create org, business, user, and optionally subscription. Replace placeholders with real values.

```sql
-- 1. Create organization (with trial dates for founder-led billing)
INSERT INTO organizations (
  id, name, billing_status, current_plan,
  trial_starts_at, trial_ends_at,
  created_at, updated_at
)
VALUES (
  gen_random_uuid(),
  'Client Business Name',           -- Change
  'trial_active',
  'starter',                         -- starter | growth | ai_pro
  NOW(),
  NOW() + INTERVAL '30 days',       -- 30-day trial
  NOW(),
  NOW()
)
RETURNING id;
-- Copy the returned org id for next steps

-- 2. Create a business (required for onboarding)
INSERT INTO businesses (
  id, organization_id, name, business_type, crm_mode, workflow_profile, created_at, updated_at
)
VALUES (
  gen_random_uuid(),
  '<PASTE_ORG_ID_HERE>',
  'My Business',                    -- Client can rename later
  'salon',                          -- salon, spa, clinic, etc.
  'lite',
  'general',
  NOW(),
  NOW()
)
RETURNING id;
-- Copy business id if you want to set active_business_id for the user

-- 3. Create user (Clerk ID is critical!)
INSERT INTO users (
  id, clerk_id, organization_id, role, email, created_at, updated_at
)
VALUES (
  gen_random_uuid(),
  'user_xxxxxxxxxxxxx',             -- FROM CLERK DASHBOARD
  '<PASTE_ORG_ID_HERE>',
  'owner',
  'client@example.com',             -- Optional
  NOW(),
  NOW()
);

-- 4. Optional: add subscription row if your app expects it for legacy logic
INSERT INTO subscriptions (
  organization_id, plan_type, status, current_period_start, current_period_end
)
VALUES (
  '<PASTE_ORG_ID_HERE>',
  'starter',
  'trialing',
  date_trunc('month', NOW()),
  date_trunc('month', NOW()) + INTERVAL '1 month'
);
```

### Step 3: Notify the Client

Tell the client they can sign in at your app URL. They will:

1. Sign in with Clerk (Google or email).
2. Pass auth sync (their `clerk_id` now exists in `users`).
3. Proceed to onboarding and use the product.

---

## 5. Managing Access (Founder Billing Controls)

### Who Can Use Founder Controls

Only users whose **Clerk user ID** or **email** is in `FOUNDER_ALLOWLIST_*` see and use the Founder Billing Controls in Settings. Everyone else sees only the read-only billing status.

### Where to Find It

1. Sign in as a founder (your allowlisted account).
2. Go to **Settings** → scroll to **Founder Billing Controls** (collapsed by default, below the Billing section).

### What You Can Do

| Action | Description |
|--------|-------------|
| **Extend trial by N days** | Adds N days to `trial_ends_at`. If trial already expired, extends from today. Sets `billing_status` to `trial_active`. |
| **Billing status** | `trial_active`, `trial_expired`, `active_manual`, `past_due_manual`, `cancelled_manual`, `suspended` |
| **Current plan** | `starter` (Basic), `growth` (Grow), `ai_pro` (Pro) |
| **Trial ends** | ISO date when trial expires |
| **Next billing due** | For manual invoicing tracking |
| **Access ends** | Hard cut-off; after this date org is read-only and suspended |
| **Manual billing notes** | Internal notes (e.g. "Invoice #12345 paid via bank transfer") |

### Billing Status Meanings

| Status | User can write data? | Automations send? | Typical use |
|--------|----------------------|-------------------|-------------|
| `trial_active` | Yes | Yes | Active trial |
| `trial_expired` | No | No | Trial ended, awaiting payment |
| `active_manual` | Yes | Yes | Paid, manually confirmed |
| `past_due_manual` | No | No | Payment overdue |
| `cancelled_manual` | No | No | Cancelled |
| `suspended` | No | No | Access revoked (e.g. `accessEndsAt` passed) |

**Read-only** means: no new customers, appointments, promos, or settings changes. User can still view data.

---

## 6. Trial Lifecycle

### When Trial Starts

- Set when you create the org (`trial_starts_at`, `trial_ends_at`) or when you first set `billing_status` to `trial_active`.
- Default: `trial_ends_at = trial_starts_at + 30 days` unless you override.

### When Trial Expires

- Evaluated on each request: if `now > trial_ends_at` and status is `trial_active`, it is treated as `trial_expired`.
- Org becomes read-only; automations stop (skipped with reason `billing_inactive`).

### After Payment / Continuation

1. Update `billing_status` to `active_manual`.
2. Optionally set `next_billing_due_at` for next invoice.
3. Add `manualBillingNotes` if needed (e.g. "Paid via bank transfer").

### Extend Trial (Quick Action)

Use "Extend by N days" in Founder Billing Controls. It:

- Extends `trial_ends_at` by N days (from now if already expired, else from current end).
- Sets `billing_status` to `trial_active`.

---

## 7. Plans (Basic / Grow / Pro)

Plans are entitlements only — no in-app purchase.

| Plan (internal) | Label | Typical features |
|-----------------|-------|------------------|
| `starter` | Basic | Core reminders, follow-ups, customer list |
| `growth` | Grow | More AI, higher limits |
| `ai_pro` | Pro | Full AI, highest limits |

To change a client's plan:

1. Open Founder Billing Controls.
2. Set **Current plan** to `starter`, `growth`, or `ai_pro`.
3. Click **Save changes**.

---

## 8. Common Scenarios

### New Client Onboarding

1. Client requests access (email or form).
2. Create Clerk user (or get their existing Clerk ID).
3. Run provisioning SQL (Section 4).
4. Notify client they can sign in.
5. Client completes onboarding in-app.

### Trial Expiring Soon

1. Use Founder Billing Controls.
2. Either: extend trial, or set `billing_status` to `active_manual` after payment.
3. Update `next_billing_due_at` and `manualBillingNotes` if needed.

### Client Stops Paying

1. Set `billing_status` to `past_due_manual` or `trial_expired`.
2. Org becomes read-only; automations stop.
3. Client sees "Access paused. Contact us to resume." in the app.

### Hard Cut-Off (End Access)

1. Set `accessEndsAt` to the cutoff date.
2. After that date, org is treated as `suspended` regardless of `billing_status`.

### Client Upgrades Plan

1. In Founder Billing Controls, set **Current plan** to `growth` or `ai_pro`.
2. Save. Changes apply immediately.

---

## 9. API Reference (Founder Endpoints)

All require **Clerk auth** and **founder allowlist** (email or user ID). Base URL: your API (e.g. `http://localhost:3001`).

### GET /admin/org-billing?organizationId=...

Returns billing state for an organization.

**Response:** `billingStatus`, `currentPlan`, `trialStartsAt`, `trialEndsAt`, `daysRemaining`, `isReadOnly`, `nextBillingDueAt`, `manualBillingNotes`, `accessEndsAt`.

### PATCH /admin/org-billing

Update billing fields. Body example:

```json
{
  "organizationId": "uuid",
  "billingStatus": "active_manual",
  "currentPlan": "growth",
  "trialEndsAt": "2025-03-31",
  "nextBillingDueAt": "2025-04-01",
  "manualBillingNotes": "Invoice #123 paid",
  "accessEndsAt": null
}
```

### POST /admin/org-billing/extend-trial

Extend trial by N days. Body:

```json
{
  "organizationId": "uuid",
  "days": 30
}
```

**Days** must be 1–365.

---

## 10. Troubleshooting

### "Access is invite-only. Contact us to get started."

- **Cause:** User is signed in with Clerk but has no row in `users`.
- **Fix:** Provision the user (Section 4).

### Founder controls not visible in Settings

- **Cause:** Your account is not in the founder allowlist, or `FF_manual_billing_controls_enabled` is false.
- **Fix:** Add your email or Clerk user ID to `FOUNDER_ALLOWLIST_*` in `.env` and restart the API. Ensure the flag is enabled.

### Client says they can't add customers / automations are paused

- **Cause:** Org is read-only (`trial_expired`, `past_due_manual`, `cancelled_manual`, or `suspended`).
- **Fix:** Update `billing_status` to `trial_active` or `active_manual`, or extend the trial.

### Temporarily allow self-signup (e.g. for testing)

Set in `.env`:

```bash
FF_public_signup_enabled=true
```

New users will be auto-created on first sign-in. Set back to `false` when done.

---

## 11. Checklist for New Client Coordination

- [ ] Client requests access (email / form)
- [ ] Obtain or create Clerk user; note Clerk User ID
- [ ] Provision org + business + user (+ optional subscription) in DB
- [ ] Set `trial_starts_at` and `trial_ends_at` (e.g. 30-day trial)
- [ ] Set `current_plan` (`starter` / `growth` / `ai_pro`)
- [ ] Notify client they can sign in
- [ ] After payment, update `billing_status` to `active_manual`
- [ ] Update `next_billing_due_at` and `manualBillingNotes` as needed

---

## 12. Related Documentation

- [README-TECHNICAL.md](./README-TECHNICAL.md) — Setup, tech stack, deployment
- [APP-FLOW-AND-TECHNICAL.md](./APP-FLOW-AND-TECHNICAL.md) — User journeys, auth flow, architecture
