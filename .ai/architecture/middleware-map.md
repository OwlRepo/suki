# Middleware / Guard / Filter Map

## Global Pipeline
- `ValidationPipe` registered in `apps/api/src/main.ts`
- `HttpExceptionFilter` registered globally in `apps/api/src/main.ts`

## AuthN/AuthZ Guards
- `ClerkAuthGuard`
- `BillingWriteGuard`
- `OwnerGuard`
- `CrmModeGuard`
- `FounderGuard`
- `PlanAiMessagingGuard`
- `TenantGuard` (tenant context)

## Functional Effect
- Authentication and tenant resolution
- `ClerkAuthGuard` reads canonical `tyvera_session`, accepts legacy `suki_session` during rebrand transition, and falls back to bearer token when no session cookie is present
- Authorization and plan gating
- Input validation and error normalization
