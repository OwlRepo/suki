# External Services Map

## Providers
- First-party auth (in-app): authentication/session logic
- OpenAI: AI generation/policy flows
- Twilio: SMS outbound/inbound/webhook status and Verify OTP; inbound/status webhooks use signature validation with exact public callback URL env vars
- Resend: email delivery
- PayMongo: billing checkout/webhook lifecycle
- CRM sources: CSV, HubSpot, Pipedrive (plus planned adapters)

## Integration Modules
- `apps/api/src/auth`
- `apps/api/src/ai`
- `apps/api/src/messaging`
- `apps/api/src/billing`
- `apps/api/src/imports/providers`

## Risk Classification
All external-provider contract changes are HIGH risk and require contract/regression tests.

## Twilio SMS Notes
- Outbound SMS still uses direct REST calls and supports Messaging Service SID or phone-number sender config.
- Inbound STOP and status callbacks require valid Twilio signatures.
- SMS usage units represent estimated billable message segments, not only API requests.
- Ambiguous network failures are recorded as unknown outcome and are not automatically retried.

## Documentation Drift Guard
When auth/provider/integration behavior changes:
- update `.ai/file-index/*` shards for touched files
- update `.ai/architecture/*` flow/docs affected by the change
- update `.env.example` and README env/API notes when interface changes
