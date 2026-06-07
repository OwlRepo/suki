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

## Expected Results

- Founder can access platform-admin pages.
- Normal tenant users are redirected away from platform-admin pages.
- Manual fulfillment requires an exact amount and grants credits once.
- Refreshing or retrying confirmation does not duplicate credits.
- Sensitive platform-admin actions appear in audit logs.
- Communications recipients are masked.
- Provider-health cards do not expose provider secrets.
- Alert acknowledgement persists after refresh.
