Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Verification

Order:
1. targeted tests
2. related suite
3. `bun run typecheck`
4. `bun run lint`
5. `bun run build`

If command unavailable, write `Not detected.`
If command fails, report:
- command
- shortest decisive failure line
- likely cause
- relation to change

If build, test, typecheck, or lint fail 3 times in row, stop. Print failure chain. Ask human review.

AI docs audit:
1. `AGENTS.md -> docs/ai/entry-point.md` intact
2. `.cursorrules -> docs/ai/entry-point.md` intact
3. bootstrap-required docs exist
4. `docs/ai/file-index/repository-map.md` reflects current tree
5. `docs/ai/architecture/dev-commands.md` matches manifests
6. `docs/ai/architecture/api-routes.md` matches controllers
7. high-risk gate language exists
