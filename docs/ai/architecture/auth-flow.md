Last updated: 2026-05-03T11:29:25.639Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Auth Flow

- Frontend auth uses Clerk (`@clerk/nextjs`).
- Backend auth guarding uses Clerk backend integrations.
- Auth-sensitive changes are high risk and require explicit confirmation.
