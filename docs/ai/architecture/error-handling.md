Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Error Handling

- API errors should use NestJS exceptions and shared filters
- preserve current response expectations for consumers
- change error message/shape only with tests
- if behavior changes, add happy-path and failure-path coverage
