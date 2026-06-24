# Risk Register

Purpose:

Map high-risk project areas.

This file is map only.

It is not proof of behavior.

Mark missing risk areas as `UNMAPPED RISK`.

| Risk Area | Why Risky | Default Task Size | Required Checks | Manual QA | Notes |
|---|---|---|---|---|---|
| Billing | Subscription state, access control, money flow | Deep | verify controller, service, webhook, and UI caller contract; regression tests; **backwards compat gate on any contract change** | billing settings, checkout, cancel/resume, admin review | `apps/api/src/billing`, dashboard billing page |
| Payments | Provider callbacks and manual confirmation can double-charge or misgrant access | Deep | verify webhook signature handling, payment status transitions, fulfillment linkage; **backwards compat gate on webhook shape or status enum changes** | payment request, confirm, reject, void | PayMongo and LemonSqueezy paths both exist |
| SMS Credits | Credit math and reconciliation can silently drift | Deep | verify metering, reconciliation, admin adjustments, related tests; **backwards compat gate on credit field or event schema changes** | credits dashboard, send flow, admin SMS adjustment | `smsCredits`, `smsUsageEvents`, reconciliation specs |
| Plan Upgrades | Plan change touches entitlements and billing state | Deep | verify plan contract, linked request flow, rollback path; **backwards compat gate on plan enum or entitlement field changes** | dashboard plan change and admin approval flow | direct and request-based paths both exist |
| Auth / Permissions | Route or guard mistake exposes private data or admin actions | Deep | verify guards, session source, workspace rules, tests; **backwards compat gate: adding a guard is safe, removing or loosening one requires approval** | sign-in, workspace switch, admin gate | Clerk plus local RBAC tables |
| Automations | Scheduler and send fanout can spam users fast | Deep | verify settings, scheduler, send, job-run, provider health contracts; **backwards compat gate on any config field or trigger contract change** | toggle automation, preview, run monitoring | automation and ops modules both involved |
| Jobs | Background retry or schedule logic can duplicate side effects | Deep | verify job state table, retries, idempotency; **backwards compat gate on job payload shape** | affected automation or ops flows | includes automation job runs |
| Webhooks | Replay and signature failures break provider truth | Deep | verify signature validation, dedupe table, failure handling; **backwards compat gate on event shape or dedupe key changes** | webhook replay or provider callback path | messaging and billing webhooks |
| Database Migrations | Schema drift can break running code and old data | Deep | verify migration, backfill, nullability, rollback order; **backwards compat gate: column removal or rename requires approval even with migration** | data readback after migration | never infer migration safety |
| Transactions | Multi-step state changes can partially apply | Deep | verify service boundaries, transaction use, reconciliation tests; **backwards compat gate on any service boundary or return shape change** | end-to-end mutation flow | billing, credits, fulfillments strongest candidates |
| External Integrations | Provider contracts can change outside repo | Deep | verify adapter and test coverage around touched provider; **backwards compat gate on adapter interface changes consumed by internal callers** | sandbox or manual provider check if safe | Twilio, Semaphore, Resend, PayMongo, LemonSqueezy, OpenAI |
| Production Deployment | CI/CD and Docker changes can brick rollout | Deep | verify workflow file, env assumptions, rollback notes; **backwards compat gate on env var renames or removal** | deploy dry review only unless explicitly approved | `.github/workflows/deploy.yml`, Docker files |

## Backwards Compatibility in Risk Areas

For all Deep risk areas: any change that alters a public contract, removes a field, renames a symbol, or changes behavior that existing tenants or integrations depend on must be labeled `BREAKING CHANGE` in the scratchpad and requires explicit user approval before `Status: IMPLEMENTATION_READY` is set. Non-breaking (additive) alternatives must be assessed first.

