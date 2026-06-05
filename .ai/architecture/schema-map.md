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
- Messaging audit data uses existing `message_events.provider` / `provider_message_id` / `provider_metadata` for Twilio, Semaphore, and Resend provider audit data and existing `sms_usage_events.units` for consumed billable segment units.
- Manual SMS safety-net tasks are stored in `manual_follow_up_tasks`, keyed uniquely by `original_message_event_id`, with optional `retry_message_event_id`, staff resolution fields, notification timestamp, recipient/message snapshots, and duplicate-risk derived from `provider_outcome_unknown`.
- Subscription persistence now includes provider-neutral Lemon Squeezy fields on `subscriptions` plus provider-aware webhook event storage in `processed_webhook_events`.
- Verified online booking credits are stored separately from outbound SMS credits via `verified_online_booking_credits`, `verified_online_booking_usage_events`, `verified_online_booking_addons`, and `credit_reconciliation_events`.
- Current webhook reconciliation mutates `subscriptions`, `organizations`, `verified_online_booking_credits`, and `credit_reconciliation_events` for subscription lifecycle changes; add-on/refund reconciliation is still incomplete.
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
