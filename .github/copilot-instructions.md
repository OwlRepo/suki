# GitHub Copilot Instructions for Tyvera

For all development tasks, use `.ai/` as the canonical AI knowledge system.

## Required Context Loading Order
1. Load `.ai/architecture/code-map.md` first.
2. Load `.ai/architecture/feature-boundaries.md`.
3. Load relevant `.ai/file-index/*.md` shards to locate exact files.
4. Discover existing tests before editing implementation files.
5. Load additional architecture/workflow docs only as required by task scope.

## Mandatory Engineering Rules
- Respect feature boundaries and avoid editing unrelated modules.
- Produce a deterministic implementation plan before modifying code.
- Strictly follow TDD: Red -> Green -> Refactor.
- Write or update tests before production code.
- Do not implement production code before the failing test exists.
- For bug fixes, add a regression test that fails before fixing the bug.
- Follow `.ai/workflows/` for feature, bug, refactor, API, and database changes.
- When updating file indexes, follow `.ai/workflows/update-file-indexes.md`:
  inspect git changes, then patch only stale index shards.

## Safety and Accuracy
- Verify file paths, symbols, and dependencies before edits.
- Verify related tests and risk level before implementation.
- Do not invent files, APIs, modules, routes, schemas, commands, or tests.
