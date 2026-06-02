# Environment Configuration

## Core Variables (by usage)
- Auth: Clerk keys/tokens (web + api auth flows)
- Database: connection variables used by `@tyvera/database`
- Billing: PayMongo credentials/webhook secrets
- Messaging: Twilio SID/token and sender config; Resend API key
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
