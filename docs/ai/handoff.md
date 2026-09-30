# Handoff and Integration

> Purpose: everything between "code validated" and "task done" — rebase, push, PR, docs sync, final report.
> Load rule: read at flow node W, before declaring any task done. The Completion Gate below is mandatory.

## Integration sequence (stated once — this is THE list)

1. Confirm the current worktree and branch match the selected task, and the diff contains no unrelated changes.
2. Commit all validated changes with focused messages (`<type>(<scope>): <description>`).
3. `git fetch origin`, then rebase onto `origin/main` (the branch has not been merged anywhere yet). If the branch is already pushed and shared, merge `origin/main` into it instead.
4. Resolve conflicts using both tasks' intent — never blindly ours/theirs. If a conflict forces choosing between product behaviors, stop and request a decision.
5. Re-run all required validation after the rebase; review the post-rebase diff.
6. Push: first push `git push --set-upstream origin <branch>`; after a rebase of an already-pushed branch, `git push --force-with-lease origin <branch>` (only then).
7. Run `gh auth switch --hostname github.com --user OwlRepo`, read `docs/ai/pr-evidence.md`, then create the PR into `main` (`gh pr create --base main`). Creating a PR is autonomous (autonomy Level 2, `.ai-engineering/core/autonomy-levels.md`). Approving, merging, or closing a PR needs explicit user instruction. A PR without the evidence its Change Type requires stays a draft.
8. After one task merges, dependent/overlapping branches rebase onto the updated `origin/main` before any later merge. Never merge two branches simultaneously.

Manual testing happens in the task worktree (`bun run dev`, or `bun run docker:dev:up`). From another checkout: `git fetch origin && git switch --track origin/<branch>`.

## Release flow (one PR into main)

The remote has one long-lived branch, `main`, plus task branches (`codex/*`, `feat/*`, `fix/*`, `infra/*`). There is no dev or staging environment.

1. PR `<branch>` → `main`, merged with **"Create a merge commit"**.
2. The push to `main` triggers `.github/workflows/deploy.yml`: `pg_dump` backup, build `api` then `web`, start containers (the API applies pending Drizzle migrations on start), health checks, public smoke check. That is the production release.
3. After merge, verify the Deploy run for that SHA concluded `success` (`gh run list --workflow deploy.yml --branch main --json headSha,status,conclusion`) and perform read-only smoke checks only.

The branch carries only commits belonging to its task. Before the PR, confirm the diff against `origin/main` contains nothing unrelated.

## Docs and learning sync (same change, mandatory)

- Update `docs/ai/file-index/repository-map.md` for every touched source area, plus the matching `docs/ai/*` contract/ownership/risk/architecture/testing map. Scope to what changed — never a blanket re-index.
- Assistant-visible changes: update `docs/assistant-context/*` and pass `bun run check:assistant-context-governance`.
- `bun run update:ai-indexes` restamps the metadata header of EVERY `docs/ai` file; run it only when a context refresh is requested (`docs/ai/context-refresh.md`), not per task.
- Genuinely new patterns or decisions: record them in `.ai-engineering/memory/architecture-decisions.md` or `lessons-learned.md`.

## Final integration gate (multi-task batches)

After all planned tasks merge: full relevant test suite, typecheck, lint, production build, migration validation, manual QA, smoke checks, cross-task regression checks.

## Completion Gate

A task is not complete unless ALL are true:

- Changes committed; branch reconciled with `origin/main`; validation re-run green afterwards (pre-existing failures named); branch pushed.
- Exact branch and latest commit SHA reported; remote branch ready for manual testing, or evidence states why manual testing is not required.
- No PR approved, merged, or closed without explicit user instruction.
- Docs sync done (section above).
- Graphify incremental maintenance ran after the final indexed edit; its graph diff and token evidence were reviewed.
- If a PR exists: its CI checks are green, verified with `gh pr checks <number>` — never assumed. Merging to `main` deploys production, so a red PR must never be merged.

## Required final report

- Task ID · implemented behavior · files changed/created.
- Compatibility: behavior preserved, public-contract impact (`BREAKING CHANGE` approvals), migration/rollout impact.
- Validation: each command run and its result. Never claim a gate passed if it was not run.
- Graphify evidence: exact command/mode, changed-file count, graph diff, semantic input/output tokens (actual, or a labelled bounded estimate + method).
- Review findings: resolved and remaining risks.
- Git state: worktree path, local branch, remote branch, target base, latest commit SHA, commits created, rebase status.
- Manual test scenarios + command to switch to the branch + `bun run dev`, or `NOT REQUIRED` with evidence.

End with this exact status block:

```text
Ready for manual testing: YES/NO/NOT REQUIRED
Ready for PR creation: YES/NO
PR created: YES/NO
Merged: YES/NO
Production verified: YES/NO/NOT APPLICABLE
```
