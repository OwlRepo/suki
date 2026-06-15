Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# External Services

- Clerk -> auth/session
- OpenAI -> AI generation and orchestration
- PayMongo -> billing compatibility and webhook flow
- Twilio -> SMS send and webhook flow
- Resend -> email send and webhook flow
- PostgreSQL -> persistence
- Svix -> dependency present in root package, source usage not detected

Ownership:
- provider contracts belong to API modules
- web should call backend APIs, not provider SDKs
