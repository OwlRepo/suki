Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Auth Flow

- frontend auth uses Clerk
- backend auth sync and guards use Clerk backend integration
- auth-sensitive change is high risk
- inspect allow and deny tests before edit
- preserve session, org, and workspace access checks
