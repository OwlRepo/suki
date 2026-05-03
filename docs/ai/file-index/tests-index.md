Last updated: 2026-05-03T11:29:25.639Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Tests Index

| Path | Purpose | Main Exports | Dependencies | Consumers | Usage Patterns | Risk |
|---|---|---|---|---|---|---|
| `apps/api/src/**/*.spec.ts` | API unit/service specs | vitest suites | Nest services/modules | dev/CI | fast domain checks | Medium |
| `apps/api/src/test/setup.ts` | API test setup | setup hooks | vitest env | API tests | common test bootstrap | Medium |
| `apps/web/src/**/*.test.ts(x)` | UI/hooks/unit specs | vitest suites | react testing libs | dev/CI | component/hook regressions | Medium |
| `apps/web/src/test/setup.ts` | web test setup | setup hooks | jsdom/testing libs | web tests | common test bootstrap | Medium |
| `apps/web/cypress/e2e/*.cy.ts` | end-to-end user journeys | cypress specs | running web+api | dev/CI | browser workflow validation | High |
| `apps/web/cypress/support/*.ts` | shared Cypress commands | support modules | Cypress | e2e specs | reusable e2e setup/commands | Medium |
