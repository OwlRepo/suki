# External Services Map

## Providers
- First-party auth (in-app): authentication/session logic
- OpenAI: AI generation/policy flows
- Twilio: SMS outbound/inbound/webhook status
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

## Documentation Drift Guard
When auth/provider/integration behavior changes:
- update `.ai/file-index/*` shards for touched files
- update `.ai/architecture/*` flow/docs affected by the change
- update `.env.example` and README env/API notes when interface changes
