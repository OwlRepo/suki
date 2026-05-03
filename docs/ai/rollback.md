Last updated: 2026-05-03T11:27:01Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Rollback

- Keep changes atomic and scoped.
- For regressions, revert commit or restore affected files.
- For DB changes, provide backward-safe migration and rollback notes.
- Validate rollback with health/test checks when applicable.
