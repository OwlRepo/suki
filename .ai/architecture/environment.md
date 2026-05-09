# Environment Configuration

## Core Variables (by usage)
- Auth: Clerk keys/tokens (web + api auth flows)
- Database: connection variables used by `@suki/database`
- Billing: PayMongo credentials/webhook secrets
- Messaging: Twilio SID/token and sender config; Resend API key
- AI: OpenAI keys and policy-related settings
- App runtime: `NODE_ENV`, app URLs, tenant/business context flags

## Source Files
- `.env` (local runtime)
- `.env.example` (documented baseline)

## Safety
- Never commit real secrets.
- Validate required vars at startup where possible.
- Treat auth/billing/ai env changes as high risk.
