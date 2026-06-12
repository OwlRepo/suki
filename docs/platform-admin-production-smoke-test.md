# Platform Admin Production Smoke Test

Run this after deploying platform-admin changes, applying migrations, seeding RBAC, and bootstrapping the existing founder account. Use real production data carefully and avoid test payments that could confuse customer records.

## Preconditions

- `bun run db:migrate` completed.
- `bun run db:seed-platform-admin-rbac` completed.
- `PLATFORM_ADMIN_BOOTSTRAP_EMAIL=<existing-login-email> bun run db:bootstrap-platform-admin` completed for the founder login.
- Manual payment environment variables are configured in production environment storage.
- Resend sender configuration is present when billing email delivery is expected.
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

## Manual Billing Email Smoke Test

Use a controlled test organization and recipient. Tyvera is still in validation and is not registered, so the attached document must remain labeled `PRO FORMA INVOICE` and must state that it is not a tax invoice, official receipt, proof of payment, or valid for input tax claims.

1. Set the test organization's billing contact email.
2. Create a subscription payment request.
3. Verify request creation succeeds before checking email delivery.
4. Confirm the UI reports `sent` and still exposes Copy payment instructions.
5. Confirm the received subject is `Tyvera Payment Request`.
6. Open the attached PDF and verify the reference, issue/due dates, bill-to organization, item, quantity, amount, total, subscription coverage, payment instructions, and validation-stage disclaimer.
7. Confirm the attachment is generated for the send and no file-storage record is created.
8. Retry the automatic path and verify no duplicate automatic delivery row or provider send occurs.
9. Use explicit resend and verify a distinct attempt row appears in delivery history.
10. Remove the billing contact email, create another request, and verify `skipped_missing_recipient` while request creation and Copy fallback still succeed.
11. Disable `FF_manual_billing_controls_enabled` and verify email controls show disabled without hiding prior delivery history.
12. In a controlled environment, remove provider configuration and verify `failed / provider_not_configured` without rolling back request creation.
13. Restore provider configuration, record and fulfill an exact payment, and verify subscription/credits activate before checking acknowledgment delivery.
14. Confirm the received subject is `Tyvera Payment Acknowledgment`, has no invoice PDF attachment, and the UI still exposes Copy acknowledgment.
15. Exercise a controlled provider rejection/transient failure and verify fulfillment remains committed while delivery history reports the failure and permits explicit resend.

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
- Billing emails use only the organization's billing contact email.
- Automatic billing-email duplicate attempts are suppressed, while explicit resends create distinct attempt rows.
- Billing request creation and fulfillment remain committed when email delivery is skipped or fails.
- Payment request emails attach only the validation-stage Pro Forma Invoice; payment acknowledgment emails do not attach an invoice.
