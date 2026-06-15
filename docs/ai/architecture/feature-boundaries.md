Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Feature Boundaries

- Web app renders UI and consumes APIs/contracts.
- API modules own business rules, validation, provider calls, policy.
- Database package owns schema, migrations, seeds, repair scripts.
- Shared packages (`ui`, `types`, `config`) stay reusable and backward-compatible.
- Direct `apps/web -> @tyvera/database` usage should stay contract/helper-only. No browser-side DB behavior.
