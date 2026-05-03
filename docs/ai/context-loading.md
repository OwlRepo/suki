Last updated: 2026-05-03T11:29:40.672Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Dynamic Context Loading

Load in this order only as needed:
1. `docs/ai/architecture/code-map.md`
2. `docs/ai/architecture/feature-boundaries.md`
3. Relevant file index in `docs/ai/file-index`
4. Relevant architecture doc
5. Relevant workflow doc
6. Related tests
7. Target source files

Do not load all docs for every task.
