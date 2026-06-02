# Environment Configuration

## Core Variables (by usage)
- Auth: Clerk keys/tokens (web + api auth flows)
- Database: connection variables used by `@tyvera/database`
- Billing: PayMongo credentials/webhook secrets
- Messaging: Twilio SID/token, sender config, Verify Service SID, exact public inbound/status callback URLs, and Resend API key
- Messaging smoke (optional): `SMOKE_REAL_PROVIDERS`, `SMOKE_TWILIO_TO`, `SMOKE_RESEND_TO`
- AI: OpenAI keys and policy-related settings
- App runtime: `NODE_ENV`, app URLs, tenant/business context flags
- Web API base: `NEXT_PUBLIC_API_URL` overrides browser API routing; production defaults to same-origin `/api`, development defaults to `http://localhost:3001`

## Source Files
- `.env` (local runtime)
- `.env.example` (documented baseline)

## Safety
- Never commit real secrets.
- Validate required vars at startup where possible.
- Treat auth/billing/ai env changes as high risk.
- Twilio production webhooks require `TWILIO_STATUS_CALLBACK_URL` and `TWILIO_INBOUND_SMS_WEBHOOK_URL` to match the exact public HTTPS URLs, including `/api` when routed through the production proxy.
- Startup warnings must never print Twilio auth tokens or other secret values.
