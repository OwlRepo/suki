# Planning Rules

> Purpose: every rule that governs WRITING a plan. Mandatory read before any plan.
> Load rule: read together with `docs/ai/plan-template.md` at flow node L. A plan written without both is invalid; the plan's metadata must state `Docs loaded: planning.md, plan-template.md`.
> Source of truth: real code, tests, types, schemas, routes, and `package.json` always beat maps and prose.

## Docs-first, then repository verification

Before reading source for a new plan, check `docs/ai/` (and `docs/assistant-context/` for assistant-visible behaviour) for existing answers. If a doc contradicts code, trust the code, mark `CONTEXT DRIFT` / `CONTRACT DRIFT`, and fix the doc in the same change.

Then verify against the repository itself:

1. Search exhaustively, not just the referenced files: enumerate every call site, consumer, test, controller route, DTO, migration, and `packages/types` export the change can reach, then inspect each. Verify every referenced path and symbol exists.
2. Search all usages of each symbol that will change (API and web both — the web consumes the API through `apps/web/src/lib/api.ts`).
3. Verify reusable components, hooks, utilities, services, guards, and DTOs BEFORE proposing any new file or abstraction. If nothing is reusable, name the inspected candidates and why each fails.
4. Never guess file names, symbols, APIs, DB fields, env vars, or patterns. Report missing files/symbols explicitly; never invent replacements.
5. Every fact in a plan traces to a file/line actually read this session. Cite important facts as path + symbol + verified behavior + why it matters.
6. A task depending on an unverified schema, permission model, FE/BE contract, or external integration is marked `UNVERIFIED DEPENDENCY` — stop and investigate before writing code that assumes it.

## Backwards compatibility (canonical rule)

Every plan runs the Backwards Compatibility Gate (`docs/ai/prompts/*`): list every public surface touched (endpoints, route/query params, request/response fields, DB columns/tables/enum values, exported symbols, guards, automation/messaging config), and state for each whether the change is additive or alters/removes something. Additive alternatives (new field alongside old, feature flag, versioned endpoint, deprecation) are evaluated first. A change that remains breaking is labelled `BREAKING CHANGE` with: what breaks, who is affected (tenants, clients, integrations), why it is necessary, and the migration/rollback path. A plan with an unlabelled or unapproved breaking change cannot be approved; ask the user explicitly: "This plan includes a breaking change. Proceeding will [impact]. Do you approve?"

## Phases, model detection, and the switch stop

Every plan is cut into phases. Each phase names BOTH the model tier and the reasoning level (use `ecc:model-route` heuristics — it cannot detect the running model, so first detect and state the model running the session from its own system context, and assign tiers relative to it).

During execution, at the end of each phase compare the next phase's (model tier, reasoning level) pair with the current one:

- Identical pair → continue automatically, no confirmation stop.
- Different in either dimension → STOP, state the required switch, wait for the user.

## Plan format

Use the canonical skeleton in `docs/ai/plan-template.md`. Plans are deterministic: every step is a literal old-text/new-text block (or, for a new file, the complete new-file content) copied from the actual current repository content — never a prose description of the change. The executing model decides nothing that was decidable at plan time. Save the approved plan to `docs/plans/<branch-short-name>.md` as the first commit of the task branch (`docs/ai/execution.md`).

Always prefer the simplest, most efficient correct solution — fewer moving parts, fewer new files, fewer new abstractions wins. Simple is not shallow: a fix that only covers the reported path is a band-aid; say so and plan the durable version. State any fact in exactly ONE place in the plan and reference it elsewhere.

When a plan ports or generates many new files (bulk scaffolding), it may specify each new file as "port of `<source path>` + the stated substitutions" instead of pasting full content, provided it says so explicitly in its metadata as a deviation and every substitution is listed.

### Forbidden language

Never use vague operations in a plan: "update component", "adjust layout", "modify styles", "preserve behavior" (without naming the behavior and proof), "where needed", "update consumers", "improve implementation", "if necessary", "etc.", "appropriate files", "relevant modules". Prose is only acceptable for genuinely new, from-scratch content that has no "old" state to diff against.

### Plan completion gate

A plan is invalid until all are true:

- Every file path is explicit and every modified symbol identified.
- Every code operation is a literal old-text/new-text block or full new-file content.
- Every dependency is listed.
- Every acceptance criterion is mapped (criterion → file → symbol → step → validation).
- Every test is mapped (exact file, scenario, assertions — never "extend tests").
- Every regression risk is mapped (file, symbol, reason, proving validation).
- Every public surface touched has a backwards-compatibility verdict; every `BREAKING CHANGE` is labelled and approved.
- Every new file is justified against verified reuse candidates.
- No forbidden language remains; no two steps restate or contradict the same fact.
- The chosen approach is the simplest correct one — a rejected simpler alternative is named with the reason.
- Every causal claim names the evidence FOR it and the observation that would DISPROVE it; unfalsifiable claims are labelled hypotheses.
- Every measurement states what it divides by and why the sample is valid (fixed overhead amortised or reported apart; cache state controlled).
- No gaps, no unverified items, no guesswork, no unsafe steps. Every open question is answered with a file/line or listed as a blocker.
- Every edge case and error case found is enumerated with its handling (file, function, branch).
- The plan carries a high-level flowchart of problem/goal → solution (`docs/ai/plan-template.md` "Flowchart").

## Batch scheduling (multi-task plans)

Produce Parallel Group A, Parallel Group B, Sequential Tasks, and Merge Order. Only parallelize tasks that share no files, symbols, types, schemas, APIs, or business logic. Merge order preference: shared foundations → schema/migrations → `packages/types` contracts → API implementation → web consumers → dependent enhancements → independent fixes.

## Drizzle / PostgreSQL discipline

Every data-touching step states:

- explicit selected columns (no whole-row selects on wide tables when a projection suffices),
- a bound (`limit`, pagination, or a proof the row count is bounded by construction),
- independent reads run in parallel (`Promise.all`); no N+1 loops over the database,
- multi-step writes that must succeed together run inside one `db.transaction(...)`,
- tenant scoping (organization/business) in the query itself, never filtered client-side,
- idempotency for anything triggered by webhooks, schedulers, or retries (unique key + conflict handling),
- any increase in query count, row scans, or connection use is flagged and reduced before implementation.

## Migrations (canonical rule)

Any plan including a database migration must satisfy ALL of:

- Additive and backward compatible: never modifies or removes existing data, never drops/renames existing tables, columns, or enum values in a way that breaks code running against the old schema, never adds `NOT NULL` columns without a `DEFAULT`.
- Dependent code is graceful WITHOUT the migration: it runs correctly against the old schema and works once applied. The plan names how each dependent path degrades pre-migration.
- Destructive operations happen ONLY with explicit user approval and are labelled `BREAKING CHANGE`.
- Generated through Drizzle: change `packages/database/src/schema/index.ts`, then `bun run db:generate` (writes `packages/database/drizzle/*.sql` + journal). Check the folder for an existing numeric prefix before committing — duplicate prefixes already exist and must not multiply.
- Apply path: `bun run db:migrate` locally (`packages/database/scripts/migrate.ts`); in production the API container runs `migrate.ts` on start (`apps/api/Dockerfile`), after `deploy.yml` takes a `pg_dump` backup. A failing migration keeps the API down and fails the deploy health check — plan the rollback order explicitly.
- A migration PR carries a migration test under `packages/database/tests/` or a `Migration-Waiver:` line naming the manual verification that replaced it (`docs/ai/testing-strategy.md`).

## Mobile-first UI

Build and verify the mobile layout first (375px, correct hit targets, no horizontal scroll), then adapt for larger breakpoints; never just stretch the mobile stack wider. Loading, empty, success, and error states are acceptance criteria, not polish.

## Assistant context governance

A plan touching `apps/web/src/app/(dashboard)/`, `apps/web/src/components/`, `apps/web/src/lib/help-content*`, `apps/api/src/help/`, or `apps/api/src/ai/` also updates `docs/assistant-context/*`, `docs/ai/file-index/repository-map.md`, and `docs/ai/architecture-manifest.md`, proven by `bun run check:assistant-context-governance` (`apps/api/src/help/assistant-context-governance.ts`).

## Mandatory Graphify phase (every implementation plan)

### Graphify is the discovery tool

Finding things — where a symbol is used, what calls what, which module owns a file — goes through Graphify against the existing `graphify-out/graph.json`: `/graphify query "<question>"`, `/graphify path "<a>" "<b>"`, `/graphify explain "<symbol>"`, `graphify affected "<symbol>"`. `grep`/`Grep`/`rg` is a fallback for when Graphify cannot answer (literal string search, an unindexed file type, a stale graph). A plan that used grep names the graphify query that failed and why. Copying the exact current text of a file for a literal old/new block is not discovery.

### Closeout

Every implementation plan ends with a Graphify maintenance step: after the last change to any indexed source or document and before review, commit, and handoff, load the `graphify` skill and run `/graphify . --update` from the repository root. Direct `graphify update .` is acceptable only for code-only changes because the CLI shortcut performs AST extraction; docs changes follow the skill's incremental semantic flow. Re-run after any later indexed edit or rebase that changes indexed files. Changes produced solely by that update do not trigger a second update.

Check `graphify --help` before selecting commands; report unsupported commands instead of emulating them. Token efficiency is mandatory:

- Prefer the existing graph and incremental `--update`; a full extraction requires a missing, corrupt, or intentionally replaced baseline with the reason stated.
- Use `query --budget`, `path`, `explain`, or `affected` for narrow questions.
- Use `cluster-only` when extraction is unchanged; use `--no-viz` for large graphs.
- Report the exact command/mode, changed-file count, graph diff, and semantic input/output token usage (actual counters, or a clearly labelled bounded estimate with its method). Never present an estimate as actual.

## Closing scans (every plan)

- Optimization scan, scoped to what the plan touches: backward-compatible only; state how functionality re-verifies; "not worth it, left as-is" is a valid answer.
- Best practices, without forcing scope: separation of concerns, reuse before new code, TDD for testable logic.
