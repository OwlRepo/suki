Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Security Guidelines

- validate all external input
- preserve authz boundaries
- never expose secrets in logs or docs
- use parameterized ORM paths, not string-built SQL
- protect provider webhooks and signatures
- review dependency risk before upgrade
