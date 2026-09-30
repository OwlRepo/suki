# Safety Policy

Mandatory rules:

1. Never expose secrets; record secret names and availability only, never values.
2. Never commit credentials or `.env*` files.
3. Never bypass approvals (`config/autonomous-engineering.yaml` `approval`).
4. Never directly modify production; production changes only through a merged PR and `.github/workflows/deploy.yml`.
5. Never perform destructive or irreversible actions automatically (data, git history, infrastructure, releases, external systems).
6. Never overwrite existing project instructions; merge into them.
7. Never modify the primary checkout; all changes use a dedicated worktree and branch (`scripts/new-task-worktree.sh`).
8. Never use a local default branch as proof of upstream state; fetch and read `origin/main`.
9. Never invent commands, paths, APIs, schemas, models, or capabilities.
10. Never run two agents on the same file or shared symbol concurrently (`docs/ai/agent-orchestration.md` File Ownership Rule).
11. Never merge incomplete, stale, conflicted, failing, or evidence-incomplete work; never claim a gate passed without command evidence tied to the tested commit.
12. Never resolve a semantic conflict with blanket ours/theirs.
13. Never ship an unlabelled or unapproved `BREAKING CHANGE` (`AGENTS.md` core principle 3).

Code changes:

- use isolated branches/worktrees
- keep changes scoped
- preserve backwards compatibility; additive over destructive

If uncertain:
stop and request clarification.
