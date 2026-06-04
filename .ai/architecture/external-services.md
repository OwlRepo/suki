# External Services Map

## Providers
- First-party auth (in-app): authentication/session logic
- OpenAI: AI generation/policy flows
- Semaphore: primary automated outbound SMS and failover booking OTP provider
- Twilio: rollback SMS outbound, inbound/webhook status, and transitional Verify OTP; inbound/status webhooks use signature validation with exact public callback URL env vars
- Resend: email delivery
- Lemon Squeezy: hosted checkout creation, customer portal redirects, and billing webhook lifecycle when self-serve billing is enabled
- CRM sources: CSV, HubSpot, Pipedrive (plus planned adapters)

## Integration Modules
- `apps/api/src/auth`
- `apps/api/src/ai`
- `apps/api/src/messaging`
- `apps/api/src/billing`
- `apps/api/src/imports/providers`

## Risk Classification
All external-provider contract changes are HIGH risk and require contract/regression tests.

## SMS and OTP Provider Notes
- Automated outbound SMS uses explicit `SMS_PROVIDER`; production should use Semaphore while Twilio can remain configured for rollback/inbound/status handling.
- Semaphore outbound SMS stores `message_events.provider = semaphore` plus provider message IDs/metadata; delivery polling is deferred.
- Semaphore booking OTP uses Tyvera-generated codes, stores only hashes on booking holds, and verifies locally with expiration and attempt limits.
- Booking OTP `OTP_PROVIDER_MODE=auto` defaults organizations to Twilio Verify until an allowlisted Twilio error code triggers durable per-organization failover to Semaphore.
- Twilio outbound SMS still supports Messaging Service SID or phone-number sender config for rollback.
- Inbound STOP and status callbacks require valid Twilio signatures.
- SMS usage units represent estimated billable message segments, not only API requests.
- Ambiguous network failures are recorded as unknown outcome and are not automatically retried.
- Public booking OTP sends check org billing state plus verified online-booking credits before sending, consume a credit only after the selected provider accepts the send, and return a safe generic message when billing or providers block the action.

## Lemon Squeezy Notes
- All Lemon-backed billing actions are gated by `FF_self_serve_billing_enabled`; when it is off, checkout/portal/mutation/webhook paths are intentionally inert and the freemium cap path remains authoritative.
- Subscription and add-on checkout URLs are created server-side from an allowlisted variant catalog.
- Billing webhook verification uses the raw request body plus `X-Signature` HMAC SHA-256 with timing-safe comparison.
- Customer portal access is treated as short-lived and fetched server-side rather than trusted from client input.
- Subscription webhook reconciliation now upserts provider-neutral subscription fields, updates organization billing state, and raises included verified-booking credits on mid-cycle upgrades without resetting usage.
- Direct owner actions now use Lemon Squeezy subscription APIs for plan changes, cancellation, and resumption, while plan activation still waits on the trusted webhook path.

## Documentation Drift Guard
When auth/provider/integration behavior changes:
- update `.ai/file-index/*` shards for touched files
- update `.ai/architecture/*` flow/docs affected by the change
- update `.env.example` and README env/API notes when interface changes
