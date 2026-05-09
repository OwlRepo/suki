Last updated: 2026-05-09T08:25:19.556Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Operating Principles

- Prefer repository truth over assumptions.
- Minimize context loading to reduce token waste.
- Keep diffs scoped and reversible.
- Do not change public contracts silently.
- Run strongest safe verification available after edits.
- Update file indexes incrementally after substantive code changes.
