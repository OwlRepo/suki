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
