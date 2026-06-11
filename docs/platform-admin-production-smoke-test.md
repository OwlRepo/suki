# Platform Admin Production Smoke Test

Run this after deploying platform-admin changes, applying migrations, seeding RBAC, and bootstrapping the existing founder account. Use real production data carefully and avoid test payments that could confuse customer records.

## Preconditions

- `bun run db:migrate` completed.
- `bun run db:seed-platform-admin-rbac` completed.
- `PLATFORM_ADMIN_BOOTSTRAP_EMAIL=<existing-login-email> bun run db:bootstrap-platform-admin` completed for the founder login.
- Manual payment environment variables are configured in production environment storage.
- Semaphore reconciliation and provider-health thresholds are configured.

## Smoke Test

1. Sign in as founder.
2. Open `/platform-admin`.
3. Confirm the overview loads.
4. Search an existing organization.
5. Create an `sms-segment-topup-25` billing request.
6. Record the exact manual payment.
7. Confirm and fulfill the payment.
8. Verify remaining SMS credits increased by 25.
9. Retry confirmation.
10. Verify no duplicate credit grant occurs.
11. Inspect the audit log.
12. Inspect the communications page.
13. Inspect the automation-runs page.
14. Inspect provider-health cards.
15. Acknowledge one alert.
16. Confirm a normal tenant user cannot open `/platform-admin`.

## Manual Subscription Smoke Test

Use a non-paying test organization currently on the free plan. Do not run destructive lifecycle steps against a real paying customer.

1. Search the test organization.
2. Create a `starter-monthly` billing request.
3. Confirm the canonical amount is exactly ₱999.
4. Record an exact ₱999 manual payment.
5. Confirm and fulfill the payment.
6. Verify the organization plan is `starter`.
7. Verify billing status is `active_manual`.
8. Verify coverage end and next billing due dates are populated.
9. Retry payment confirmation.
10. Verify no duplicate subscription period, fulfillment, or credit reconciliation is created.
11. Mark the subscription past due with a reason.
12. Set a future grace-until date and verify tenant writes remain available during grace.
13. Suspend the test organization and verify it becomes read-only.
14. Reactivate while paid coverage remains.
15. Verify subscription request, activation, lifecycle, and billing-contact audit events.

## Expected Results

- Founder can access platform-admin pages.
- Normal tenant users are redirected away from platform-admin pages.
- Manual fulfillment requires an exact amount and grants credits once.
- Refreshing or retrying confirmation does not duplicate credits.
- Sensitive platform-admin actions appear in audit logs.
- Communications recipients are masked.
- Provider-health cards do not expose provider secrets.
- Alert acknowledgement persists after refresh.
- Manual subscription fulfillment activates canonical paid coverage exactly once.
- Manual lifecycle changes require explicit platform-admin action and are audited.
