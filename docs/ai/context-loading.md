Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Context Loading

Load only what task needs.

For code change:
1. `docs/ai/architecture/code-map.md`
2. `docs/ai/architecture/feature-boundaries.md`
3. `docs/ai/file-index/repository-map.md`
4. relevant workflow
5. related tests
6. target files

Rules:
- Do not load whole tree by default.
- Prefer architecture map before raw search.
- Prefer tests before source edits.
- Stop loading when answer clear.
