Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# TDD Development Workflow

TDD mandatory for behavior change.

1. Classify task.
2. Locate source with architecture docs and `docs/ai/file-index/repository-map.md`.
3. Locate existing tests before source edit.
4. RED:
- write smallest failing test first
- bug fix needs regression test
- confirm failure for right reason
5. GREEN:
- write minimum code to pass
- keep scope tight
6. REFACTOR:
- improve structure after green
- no new behavior
7. Verify:
- targeted test
- related suite
- typecheck
- lint
- build if needed

Exempt only:
- docs
- formatting
- comments
- file-index
- generated docs
- non-behavioral config

Complex visual-only UI may relax strict TDD if DOM/a11y checks cannot prove result. Human visual check then required.
