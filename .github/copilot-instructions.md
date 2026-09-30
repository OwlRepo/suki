# GitHub Copilot Instructions for Tyvera

`AGENTS.md` is the canonical AI workflow for this repository, and `CLAUDE.md`
holds the verified project facts. The `docs/ai/` maps route every task.

## Required Context Loading Order
1. `AGENTS.md` (Canonical Task Flow, core principles, backwards-compatibility rule).
2. `CLAUDE.md` (stack, conventions, database rules).
3. `docs/ai/task-router.md`, then `docs/ai/architecture-manifest.md` and `docs/ai/module-ownership-map.md`.
4. `docs/ai/file-index/repository-map.md` to locate exact files.
5. Discover existing tests before editing implementation files.

## Mandatory Engineering Rules
- Respect module boundaries and avoid editing unrelated modules.
- Produce a deterministic implementation plan before modifying code (`docs/ai/planning.md`).
- Strict TDD: failing tests first, ordered `error:` > `edge:` > `regression:` > `happy:`, proven with `bun run tdd:red` (`docs/ai/testing-strategy.md`).
- For bug fixes, add a regression test that fails before fixing the bug.
- No backwards-incompatible change without a labelled `BREAKING CHANGE` and explicit approval.
- After a code change, refresh only the affected rows of `docs/ai/file-index/repository-map.md` and the matching `docs/ai/*` maps.

## Safety and Accuracy
- Verify file paths, symbols, and dependencies before edits.
- Do not invent files, APIs, modules, routes, schemas, commands, or tests.
