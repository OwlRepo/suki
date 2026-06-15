Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# API Change Workflow

Use for request, response, route, or controller contract change.

Do:
- inspect controller, service, DTO, consumer
- write failing contract test first
- preserve backward compatibility unless approved
- update `docs/ai/architecture/api-routes.md`
- update repository map if ownership changed
