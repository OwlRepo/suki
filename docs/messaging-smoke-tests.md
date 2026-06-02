# Messaging Smoke Tests (Twilio + Resend)

These tests are optional and credential-gated. They are designed to be skipped by default and become runnable once provider keys are configured.

## Default local test run (mocked/unit)

```bash
bun run --cwd apps/api test:run
bun run --cwd apps/web test:run
```

Expected: regular unit/integration tests run. Real-provider smoke tests are skipped.

## Enable real-provider smoke tests

Set env values:

- `SMOKE_REAL_PROVIDERS=true`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_PHONE_NUMBER`
- `TWILIO_STATUS_CALLBACK_URL`
- `TWILIO_INBOUND_SMS_WEBHOOK_URL`
- `TWILIO_VERIFY_SERVICE_SID`
- `SMOKE_TWILIO_TO`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SMOKE_RESEND_TO`

Then run:

```bash
SMOKE_REAL_PROVIDERS=true bun run --cwd apps/api test:run -- src/messaging/smoke/provider-smoke.spec.ts
```

Expected pass criteria:

- Twilio returns `ok: true` and a message SID.
- Resend returns `ok: true` and an email ID.

If preflight is incomplete, the suite is skipped with explicit missing-env diagnostics.

## Production SMS rollout checklist

Do not run real sends without explicit approval. Use redacted secrets in commands and logs.

1. Send one normal outbound SMS and confirm Twilio returns a Message SID.
2. Send one intentionally multi-segment outbound SMS and confirm Tyvera consumes the expected segment count.
3. Confirm `sms_usage_events.units` and monthly `sms_credits.used` match the estimated segment count.
4. Confirm `message_events.provider_message_id` stores the Twilio Message SID.
5. Confirm status callbacks transition delivery state from queued/sent to delivered or failed.
6. Send a public booking OTP and confirm delivery.
7. Verify a valid OTP confirms the booking hold.
8. Reply `STOP` from the customer phone.
9. Confirm the matching customer gets `sms_opted_out_at` and consent audit logs.
10. Confirm a later SMS dispatch to that customer is skipped because of opt-out.
11. Send a forged unsigned inbound STOP request and confirm it returns authorization failure.
12. Send an incorrectly signed status callback and confirm it returns authorization failure.
13. Send valid signed callbacks through the production reverse proxy and confirm the configured public URLs with `/api` validate successfully.

Example forged webhook checks:

```bash
curl -i -X POST https://tyvera.app/api/messaging/inbound/sms \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'From=%2B639171234567&Body=STOP'

curl -i -X POST https://tyvera.app/api/messaging/webhooks/twilio/status \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'X-Twilio-Signature: invalid' \
  --data 'MessageSid=SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX&MessageStatus=delivered'
```

Expected: both forged requests fail authorization and do not mutate consent or delivery state.
