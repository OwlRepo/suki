Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Rollback

- Keep diff small so rollback small.
- Prefer scoped revert, not broad reset.
- Restore contract first.
- Re-run targeted tests, then typecheck/lint/build as needed.
- Document what rolled back, why, what still risky.
