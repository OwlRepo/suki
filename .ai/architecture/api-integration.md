# API Integration

## Web -> API
- Web app uses utility clients in `apps/web/src/lib` to call REST endpoints served by `apps/api`.
- Production browser requests default to same-origin `/api/*`; `apps/web/next.config.ts` rewrites those requests to the Docker API service at `http://api:3001/*`.
- Development browser requests default to `http://localhost:3001/*` unless `NEXT_PUBLIC_API_URL` is explicitly set.
- Auth/session alignment is handled through Clerk integration in both apps.
- Tyvera Assistant UI updates usage bars immediately from stream `usage` events and still refetches `/ai/usage/summary` after successful streamed/non-streamed replies for reconciliation.

## External Integrations
- Payments: Lemon Squeezy checkout, portal, and webhook billing services
- Messaging: Twilio SMS + Resend email; Twilio inbound/status callbacks validate signatures against explicit public callback URL env vars instead of internal request URLs
- AI: OpenAI via API AI module services
- CRM import providers: CSV, HubSpot, Pipedrive (+ stubs for others)

## Assistant Context Integration
- Assistant runtime context is sourced from `docs/assistant-context/**/*.md` and normalized by the API loader.
- Retrieval is deterministic and query-aware: intent mapping + route/action keyword scoring + priority ordering.
- Governance is hard-blocked in Codex/CI for behavior-impacting FE/BE changes unless assistant markdown docs, `.ai/file-index/*`, and `.ai/architecture/*` are updated together.

## OpenAI Observability
- OpenAI calls from `AiExecutionService` emit structured logs for request start, success, and error paths.
- Logs include bounded request/response previews plus token usage metadata for debugging assistant orchestration and fallback behavior.
- Daily AI policy blocks are surfaced as explicit assistant error semantics (not generic low-confidence fallback), with usage endpoints providing daily cap and reset metadata for UI transparency.
- Assistant chat orchestration now requests OpenAI JSON-schema structured output (`response_format: json_schema`) for fixed-shape payloads and only applies bounded compatibility normalization for legacy alias fields.

## Integration Safety
- Contract changes must be test-backed (request + response).
- Provider/webhook modules are high-risk and require regression protection.
- SMS credits are counted as estimated billable SMS segments after the final outbound body is assembled; provider-reported segment counts are stored as metadata for audit/reconciliation.
