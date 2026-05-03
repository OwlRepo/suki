Last updated: 2026-05-03T11:29:40.672Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Testing Strategy

| Area | Framework | Location |
|---|---|---|
| API unit/integration | Vitest | `apps/api/src/**/*.spec.ts` |
| Web unit/component | Vitest | `apps/web/src/**/*.test.ts(x)` |
| Web e2e | Cypress | `apps/web/cypress/e2e/*.cy.ts` |

Commands:
- `bun run test`
- `bun run test:e2e`

Minimum verification:
- run related tests for changed area
- run typecheck and lint for medium/high risk changes
