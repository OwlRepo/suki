Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Testing Strategy

Coverage map:
- API unit/integration -> `apps/api/src/**/*.spec.ts`
- Web unit/component -> `apps/web/src/**/*.test.ts(x)`
- Web e2e -> `apps/web/cypress/e2e/*.cy.ts`
- Shared package tests -> package-local `*.spec.ts`

Rules:
- run targeted test first
- bug fix needs regression test
- API change tests request and response behavior
- auth change tests allow and deny paths
- UI behavior change tests DOM or state when practical
