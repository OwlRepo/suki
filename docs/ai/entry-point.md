# AI Entry Point

Split brain:

- Claude Code plans.
- Codex executes.
- `.ai-scratchpad.md` is transient handoff truth.

## Load Order

Code task:

1. `docs/ai/architecture-manifest.md`
2. `docs/ai/file-index/repository-map.md`
3. Related tests
4. Target source files

Read least context needed. Repo truth beats docs.

## Route

Choose exactly one lane.

- BUG / RCA: diagnose -> prove cause -> human approval -> exact plan -> human approval -> `.ai-scratchpad.md`.
- MUTATION: map boundaries -> find tests -> exact plan -> human approval -> `.ai-scratchpad.md`.
- READ-ONLY: discover -> evidence-backed answer -> stop. No file generation.

## Planner Contract

- Follow `CLAUDE.md`.
- Plan Mode.
- No source edits.
- Only approved handoff may write `.ai-scratchpad.md`.
- Real paths. Exact symbols. No optional work.

## Executor Contract

- Follow `.codex/instructions.md`.
- Read `.ai-scratchpad.md`.
- Execute directives in order.
- No redesign, optimization, or scope growth.
- Stop on ambiguity or unsafe instruction.

## TDD

- Mandatory for behavior change.
- RED: smallest failing test first.
- GREEN: minimum code.
- REFACTOR: no new behavior.
- Bug fix needs regression test.
- Exempt: docs, formatting, comments, file index, generated docs, non-behavioral config.
- Visual-only UI: DOM/a11y checks when possible. Human visual check if code cannot prove layout.

## Gates

- Deterministic plan before code.
- No dependency without human approval.
- Never commit on `main` or `master`.
- Conventional Commits.
- High risk needs explicit approval: auth, billing, security, privacy, schema, providers, AI policy, CI/CD, production.
- Test, build, typecheck, or lint fails 3 times: stop. Print failure chain. Ask human review.
- After code change: update affected repository ledger rows. Update architecture manifest only when truth changed.

## File Index Maintenance

1. Run `git status --short`.
2. Run `git diff --name-only`.
3. Map changed paths to ledger rows.
4. Update affected rows only.
5. Verify every changed path exists or was intentionally removed.
6. Fail completion if AI integration docs stale.
