# API Integration

## Web -> API
- Web app uses utility clients in `apps/web/src/lib` to call REST endpoints served by `apps/api`.
- Auth/session alignment is handled through Clerk integration in both apps.

## External Integrations
- Payments: PayMongo webhook and billing services
- Messaging: Twilio SMS + Resend email
- AI: OpenAI via API AI module services
- CRM import providers: CSV, HubSpot, Pipedrive (+ stubs for others)

## Integration Safety
- Contract changes must be test-backed (request + response).
- Provider/webhook modules are high-risk and require regression protection.
