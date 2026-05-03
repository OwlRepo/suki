Last updated: 2026-05-03T12:47:29.246Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Security Guidelines

- validate all external inputs
- enforce auth checks and authorization boundaries
- never expose secrets in logs/docs
- review dependency risks before upgrades
- prevent XSS in rendered user content
- preserve session/auth integrity
- prevent SQL injection by using ORM/query parameterization
- apply rate limiting for abuse-prone endpoints when applicable
