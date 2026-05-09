Last updated: 2026-05-09T12:07:06.828Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Verification

Preferred command order:
1. `bun run typecheck`
2. `bun run lint`
3. related tests (`bun run test` or package-level test)
4. full test suite if reasonable
5. `bun run build`

If unavailable, document as: `Not detected.`
If failure occurs, report: command, summary, likely cause, relation to change.

## AI Docs Audit Checklist
1. Validate `AGENTS.md -> docs/ai/entry-point.md` path is intact.
2. Validate all required docs exist and remain markdown-only.
3. Cross-check `dev-commands.md` against root/workspace manifests.
4. Cross-check `api-routes.md` controller list against `apps/api/src/**/*.controller.ts`.
5. Cross-check `tests-index.md` and `testing-strategy.md` against discovered test files.
6. Cross-check `environment.md` variable names against source references.
7. Confirm high-risk gating language exists in entry/workflow/risk docs.
