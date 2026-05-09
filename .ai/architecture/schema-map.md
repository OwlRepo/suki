# Schema Map

## Request Validation Sources
- Nest DTO-like typed bodies/queries in controllers
- Global `ValidationPipe` in `apps/api/src/main.ts`
- TypeScript interfaces/types from `@suki/types` and module-local declarations

## Response Shape Sources
- Service method return objects serialized by controllers
- Shared types where explicitly imported

## Storage Schema Sources
- Drizzle SQL migrations under `packages/database/drizzle`
- Database package scripts under `packages/database/scripts`

## High-Risk Contract Areas
- Billing and webhook payloads
- Messaging provider/webhook payloads
- Licensing activation/attestation flows
- Import parsing/commit/rollback payloads
- AI usage policy and quota contracts
