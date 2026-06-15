Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Operating Principles

- Repo truth first. Guess last.
- Load least context needed.
- Keep diffs small, scoped, reversible.
- Do not change public contract silently.
- TDD mandatory for behavior change unless exempt.
- Run strongest safe verification after edit.
- Update `docs/ai/file-index/repository-map.md` after code change.
- Update affected `docs/ai/architecture/*` when flow, contract, or boundary changes.
- Prefer short docs. Kill stale docs.
