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
- Messaging audit data uses existing `message_events.provider_metadata` for SMS segment estimates/provider-reported counts and existing `sms_usage_events.units` for consumed billable segment units; no schema migration is required for current Twilio hardening.
- `customers.mobile` is expected to be blank/null or a strict Philippine E.164 mobile value (`+639171234567`) for new API/web/import writes; existing legacy values are not automatically rewritten.
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
