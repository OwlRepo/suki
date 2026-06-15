Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Update File Indexes Workflow

Purpose: keep `docs/ai/file-index/repository-map.md` true.

Steps:
1. run `git status`
2. run `git diff --name-only`
3. map changed paths to affected rows
4. update only stale rows in `docs/ai/file-index/repository-map.md`
5. update affected `docs/ai/architecture/*` if flow or contract changed
6. do not rewrite unrelated rows

Rules:
- one dense `repository-map.md`
- add rows for new files
- remove rows for deleted files
- keep concise navigation value
- no source dumps

Final gate:
- verify changed paths exist or were intentionally removed
- verify stale integration docs are updated
- fail task completion if drift remains
