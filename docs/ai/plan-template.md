# Plan Template (canonical skeleton)

Every plan in this repo uses this section structure. It satisfies the
deterministic-spec rules in `docs/ai/planning.md` by embedding literal
old-text/new-text blocks (or full new-file content) inline in each phase step.
Read `docs/ai/planning.md` together with this file before writing any plan.
Save the approved plan to `docs/plans/<branch-short-name>.md` as the first
commit on the task branch.

Phase-stop rule: execution stops when the next phase's model tier or reasoning
level differs from the current pair (`docs/ai/planning.md`). Identical pairs
continue automatically.

---

## <Plan title>

<TL;DR: 2-4 plain-language sentences. What's broken/needed (root cause in one
sentence) and what will be built, understandable by a non-technical teammate.>

### Flowchart (high-level)

<One high-level flowchart: the problem/goal on the left, the solution shape on
the right. Rendered inline for review via `mcp__visualize__show_widget` when
available, and recorded here as a mermaid block so the saved plan keeps it.
High level only — never a per-file breakdown.>

### Task metadata

- Classification: `BUG_FIX|ENHANCEMENT|NEW_FEATURE|REFACTOR|PERFORMANCE|INFRASTRUCTURE|DOCUMENTATION` · `SMALL|MEDIUM|LARGE` · <domain> · <risk>
- Docs loaded: `planning.md, plan-template.md` (mandatory canary — a plan missing this line is invalid)
- Backwards compatibility: `None` | `Additive` | `BREAKING CHANGE — approved by user on <date>` (per surface, `docs/ai/planning.md` "Backwards compatibility")
- Claims reversed while investigating: <each claim asserted and later disproved, with what disproved it — or "none">
- Root cause: <one sentence with file/symbol evidence> (bug fixes only)
- Detected running model: <model currently running this session>
- Recommended model: `<tier>`, <reasoning level>; confidence <level>. Fallback: `<tier>`.
- Branch: `<type>/<ticket-id|no-ticket>-<short-name>` (from `origin/main`)
- Release path: one branch → one PR into `main`, merge commit (`docs/ai/handoff.md` "Release flow"). Merging deploys production.
- Required skills: </investigate, ecc:model-route, /qa, ecc:code-review, ...>
- Execution preflight: `git fetch origin`, then `scripts/new-task-worktree.sh <type> <short-name>`, then `bun install --frozen-lockfile` in the worktree.

### Phase 1 — RED (`<model>`, <reasoning>)

Write every Test Matrix test (cases `error:` > `edge:` > `regression:` > `happy:`), run `bun run tdd:red`, paste the failing output, commit as `test(<scope>): ...`. No workspace `src/` logic changes in this phase.

Done: `bun run tdd:red` exit 0 with the failing titles recorded.

### Phase N — <title> (`<model>`, <reasoning>)

1. <Path to file.ts. Then a literal "Old:" fenced block with the exact current text and a literal "New:" fenced block with the exact replacement — or, for a new file, one fenced block with the complete new-file content.>
2. ...

Done: <objective, observable completion condition for the phase.>

### Validation and acceptance

- **Test Matrix (mandatory table):** one row per layer from `docs/ai/testing-strategy.md` "Mandatory Test Layers" — `layer | required / not required + reason | file | cases`, cases listed `error:` > `edge:` > `regression:` > `happy:`.
- Run: <real commands from package.json — `bun run typecheck`, `bun run lint`, targeted `../../node_modules/.bin/vitest run <file>` from the workspace, `bun run test`, `bun run build`, `bun run check:assistant-context-governance` when applicable.>
- Mock/seed data: <per-task, clearly tagged fixtures created by the tests themselves; never `db:seed`/`db:reset` against a shared database.>
- Graphify gate (MANDATORY): load `graphify`, run `/graphify . --update` after the final indexed edit, report graph diff plus semantic input/output tokens.

### Compatibility, docs, and scans

- <Per public surface: additive vs breaking verdict; migration backward-compat statement per `docs/ai/planning.md` "Migrations" when a migration exists.>
- <docs/ai and docs/assistant-context files to update in the same change (`docs/ai/handoff.md`).>
- Optimization scan: <opportunity or "not worth it, left as-is">.
- Data impact (`docs/ai/planning.md` "Drizzle / PostgreSQL discipline"): <explicit columns/bounds/round-trips/transactions; flag any increase>.
