# Risk Register

Purpose:

Map high-risk project areas.

This file is map only.

It is not proof of behavior.

Mark missing risk areas as `UNMAPPED RISK`.

| Risk Area | Why Risky | Default Task Size | Required Checks | Manual QA | Notes |
|---|---|---|---|---|---|
| Billing | Subscription state, access control, money flow | Deep | verify controller, service, webhook, and UI caller contract; regression tests | billing settings, checkout, cancel/resume, admin review | `apps/api/src/billing`, dashboard billing page |
| Payments | Provider callbacks and manual confirmation can double-charge or misgrant access | Deep | verify webhook signature handling, payment status transitions, fulfillment linkage | payment request, confirm, reject, void | PayMongo and LemonSqueezy paths both exist |
| SMS Credits | Credit math and reconciliation can silently drift | Deep | verify metering, reconciliation, admin adjustments, related tests | credits dashboard, send flow, admin SMS adjustment | `smsCredits`, `smsUsageEvents`, reconciliation specs |
| Plan Upgrades | Plan change touches entitlements and billing state | Deep | verify plan contract, linked request flow, rollback path | dashboard plan change and admin approval flow | direct and request-based paths both exist |
| Auth / Permissions | Route or guard mistake exposes private data or admin actions | Deep | verify guards, session source, workspace rules, tests | sign-in, workspace switch, admin gate | Clerk plus local RBAC tables |
| Automations | Scheduler and send fanout can spam users fast | Deep | verify settings, scheduler, send, job-run, provider health contracts | toggle automation, preview, run monitoring | automation and ops modules both involved |
| Jobs | Background retry or schedule logic can duplicate side effects | Deep | verify job state table, retries, idempotency | affected automation or ops flows | includes automation job runs |
| Webhooks | Replay and signature failures break provider truth | Deep | verify signature validation, dedupe table, failure handling | webhook replay or provider callback path | messaging and billing webhooks |
| Database Migrations | Schema drift can break running code and old data | Deep | verify migration, backfill, nullability, rollback order | data readback after migration | never infer migration safety |
| Transactions | Multi-step state changes can partially apply | Deep | verify service boundaries, transaction use, reconciliation tests | end-to-end mutation flow | billing, credits, fulfillments strongest candidates |
| External Integrations | Provider contracts can change outside repo | Deep | verify adapter and test coverage around touched provider | sandbox or manual provider check if safe | Twilio, Semaphore, Resend, PayMongo, LemonSqueezy, OpenAI |
| Production Deployment | CI/CD and Docker changes can brick rollout | Deep | verify workflow file, env assumptions, rollback notes | deploy dry review only unless explicitly approved | `.github/workflows/deploy.yml`, Docker files |

