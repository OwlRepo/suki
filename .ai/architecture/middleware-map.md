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
- Authorization and plan gating
- Input validation and error normalization
