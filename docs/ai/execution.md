# Execution Rules

> Purpose: every rule that governs IMPLEMENTING an approved plan — worktree, code, review, QA.
> Load rule: read at flow node S, before creating the worktree or writing any code.
> Source of truth: real code and `package.json` scripts beat this map.

## Worktree and branch isolation

Planning, investigation, and review-only sessions need no worktree. Any session that modifies files requires one dedicated task branch and worktree:

1. `git fetch origin`, then create a NEW worktree and branch from the fetched `origin/main` with `scripts/new-task-worktree.sh <type> <short-name>` (worktrees live under `.claude/worktrees/`, which is gitignored). Run `bun install --frozen-lockfile` inside it. Then copy the approved plan from the harness plan file (Claude Code keeps it at `~/.claude/plans/<slug>.md`) to `docs/plans/<branch-short-name>.md` and commit it alone (`docs(<scope>): approved plan ...`) before the RED commit.
2. Branch naming: `fix|feat|refactor|perf|infra|docs/<ticket-id|no-ticket>-<short-name>`.
3. Never modify the primary checkout. Never reuse another task's worktree. Never create nested/duplicate worktrees for one branch. Never delete a worktree automatically. One branch + worktree per logical task.
4. If safe worktree creation is unavailable, stop before modifying anything and report the exact command required.

## Single-task rule

Implement ONLY the selected task; everything else is read-only context. No partial implementation of future tasks, no speculative code. Follow the approved plan unless repository evidence proves it invalid — then stop and report the contradicted assumption, the code evidence, and the required correction. An unflagged `BREAKING CHANGE` discovered during implementation stops the task and returns to planning for approval.

## Implementation rules

1. One logical change at a time; minimal diff; no unrelated cleanup; no speculative abstractions.
2. Preserve existing naming and architecture conventions (`CLAUDE.md` "Conventions").
3. Add or update tests with behavior changes. Never weaken or remove tests to make them pass.
4. Fix type/lint/runtime errors; never suppress them.
5. No dependency or lockfile changes unless the plan requires them and the user approved. No destructive DB operations without explicit approval.
6. After each validated logical unit, create a focused commit: `<type>(<scope>): <concise description>`. Never combine unrelated changes in one commit.
7. Persona files: edit `agents/src/*`, then `bun run agents:generate`; the husky pre-commit hook runs `bun run agents:lint` when persona paths are staged.

## Mandatory Graphify closeout

After the final change to any indexed source or document, load the `graphify` skill and run `/graphify . --update` from the repository root before review, commit, and handoff. Re-run after a later indexed edit or a rebase that changes indexed files. Failure, skipped execution, or unreviewed graph/token evidence blocks completion. Command selection and token rules: `docs/ai/planning.md` "Mandatory Graphify phase".

## Testing requirements

The runner is vitest 3 per workspace (`apps/web`, `apps/api`, `packages/types`) plus `node:test` for `scripts/**/*.test.mjs` — verify scripts in `package.json`; do not assume Jest or Playwright.

- RED first, always: write every test in the plan's Test Matrix (cases `error:` > `edge:` > `regression:` > `happy:`), run `bun run tdd:red`, see it fail, and commit the tests alone as `test(<scope>): ...` BEFORE touching workspace `src/` logic. The Claude hook blocks src edits until then, and the CI `tdd:gate` re-proves the RED against the base. Full rule: `docs/ai/testing-strategy.md` "Strict TDD".
- Coverage of ALL of these is mandatory: happy path, error cases, loading states (UI), and edge cases. Backend changes also cover rare/boundary cases and idempotent retries.
- Bugs found during testing are fixed in the same task, never deferred.
- Tests seed their own isolated data; never run `db:seed`, `db:reset`, or migrations against a shared or production database from a task.
- Local stack and ports: `docs/ai/dev-environment.md`.

## Review mode

Review runs separately from implementation (fresh session or different model preferred). Invoke `ecc:code-review` (or `/review` for the gstack pre-landing pass) and inspect the actual diff, not just final file state. Check: acceptance criteria, root-cause correctness, scope creep, hidden regressions, backwards compatibility, architecture violations, duplicate logic, dead code, security, performance, missing/weak tests, error handling. Never approve solely because tests pass.

## QA mode

Invoke `/qa` (test-and-fix) or `/qa-only` (report-only). Run the validation the approved plan defines — the standard command set:

- targeted tests first (`../../node_modules/.bin/vitest run <file>` from the workspace, `node --test <file>` for scripts), then `bun run test`
- `bun run typecheck`
- `bun run lint`
- `bun run build` when build-affecting files change
- `bun run check:assistant-context-governance` when assistant-visible areas change

Compare results against the pre-change baseline: failures that already existed on `origin/main` are reported as pre-existing, never hidden and never counted as caused by the task. Report each command and its result. Never claim validation that was not executed. Then proceed to `docs/ai/handoff.md`.
