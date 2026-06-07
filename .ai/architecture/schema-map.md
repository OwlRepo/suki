# Schema Map

## Request Validation Sources
- Nest DTO-like typed bodies/queries in controllers
- Global `ValidationPipe` in `apps/api/src/main.ts`
- TypeScript interfaces/types from `@tyvera/types` and module-local declarations

## Response Shape Sources
- Service method return objects serialized by controllers
- Shared types where explicitly imported

## Storage Schema Sources
- Drizzle SQL migrations under `packages/database/drizzle`
- Database package scripts under `packages/database/scripts`
- Platform-admin RBAC uses `platform_admins`, `admin_roles`, `admin_permissions`, `platform_admin_roles`, and `admin_role_permissions`; seed scripts upsert role/permission data and founder bootstrap only promotes an existing `users` row.
- Platform-admin manual billing uses `manual_billing_requests`, `manual_billing_request_items`, `manual_payments`, and `manual_billing_fulfillments`; request rows store one unique Tyvera reference, item rows snapshot SKU/purchase-kind/units/quantity/PHP price, payments store reported manual transfer metadata, and fulfillments enforce exactly-once item fulfillment with a unique `billing_request_item_id`.
- Platform-admin sensitive actions are recorded in `platform_admin_audit_logs` with actor platform-admin/user IDs, optional organization, action/entity metadata, and JSON details.
- SMS and verified-booking add-on rows include provider-neutral `source` and `source_reference` metadata with unique `(source, source_reference)` constraints so Lemon Squeezy, manual payments, and admin adjustments share the same idempotent fulfillment surface.
- Messaging audit data uses existing `message_events.provider` / `provider_message_id` / `provider_metadata` for Twilio, Semaphore, and Resend provider audit data and existing `sms_usage_events.units` for consumed billable segment units.
- Platform-admin communications monitoring reuses `message_events`, `sms_usage_events`, `email_usage_events`, `manual_follow_up_tasks`, and `public_otp_send_events`; API responses mask recipients and omit full content plus raw provider metadata.
- Manual SMS safety-net tasks are stored in `manual_follow_up_tasks`, keyed uniquely by `original_message_event_id`, with optional `retry_message_event_id`, staff resolution fields, notification timestamp, recipient/message snapshots, and duplicate-risk derived from `provider_outcome_unknown`.
- Subscription persistence now includes provider-neutral Lemon Squeezy fields on `subscriptions` plus provider-aware webhook event storage in `processed_webhook_events`.
- Resend delivery webhooks are idempotently claimed in `processed_webhook_events` with `event_id = resend:<svix-id>`, provider `resend`, payload hash, processed/failed status, failure reason, and retry count.
- Verified online booking credits are stored separately from outbound SMS credits via `verified_online_booking_credits`, `verified_online_booking_usage_events`, `verified_online_booking_addons`, and `credit_reconciliation_events`.
- Current webhook reconciliation mutates `subscriptions`, `organizations`, `verified_online_booking_credits`, and `credit_reconciliation_events` for subscription lifecycle changes; Lemon Squeezy add-on grants now reuse provider-neutral SMS/verified-booking grant services while refund reconciliation continues to use existing add-on refund-unit logic.
- Public OTP sends mutate `verified_online_booking_credits.used` and append `verified_online_booking_usage_events` only after a successful Twilio Verify or Semaphore OTP send.
- Booking holds persist OTP challenge provider state in `booking_holds.otp_provider`, `otp_provider_message_id`, `otp_code_hash`, and `otp_code_expires_at`; Semaphore OTP stores hashes only and clears the hash after successful confirmation.
- Durable OTP failover state is organization-scoped in `otp_provider_settings`; `auto` mode defaults to Twilio when no row exists and switches to Semaphore only after allowlisted permanent Twilio failures.
- `customers.mobile` is expected to be blank/null or a strict Philippine E.164 mobile value (`+639171234567`) for new API/web/import writes; existing legacy values are not automatically rewritten.
- `customers.business_id + customers.mobile` is indexed for booking-time exact mobile reuse but is not unique yet because legacy duplicates may exist.
- `appointments.status` includes lifecycle states `scheduled`, `checked_in`, `needs_review`, `completed`, `missed`, and `cancelled`; `duration_minutes`, `checked_in_at`, `needs_review_at`, `completed_at`, and `visit_recorded_at` snapshot lifecycle state.
- Completed appointment visit recording is idempotent through `appointments.visit_recorded_at`; historical completed appointments are not replayed or backfilled.
- `booking_holds.mobile` is expected to be a strict Philippine E.164 mobile value (`+639171234567`) because booking holds feed OTP verification.

## High-Risk Contract Areas
- Billing and webhook payloads
- Messaging provider/webhook payloads
- Licensing activation/attestation flows
- Import parsing/commit/rollback payloads
- AI usage policy and quota contracts

## Existing Mobile Cleanup Checklist
Run a reporting pass before broader OTP rollout and manually correct invalid existing records:

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
