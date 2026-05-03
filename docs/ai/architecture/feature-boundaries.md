Last updated: 2026-05-03T11:29:53.965Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Feature Boundaries

- Web app should consume APIs/contracts without duplicating backend business rules.
- API modules own domain behavior and data validation.
- Database package owns schema/migration operations.
- Shared packages (`ui`, `types`) must remain backward-compatible when used by both apps.
