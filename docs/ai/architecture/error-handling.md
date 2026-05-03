Last updated: 2026-05-03T11:27:01Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Error Handling

- API errors should use NestJS exceptions and shared filters where present.
- Preserve existing error response expectations for consumers.
- Add or update tests when error behavior changes.
