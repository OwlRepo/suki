<!-- BEGIN:ai-engineering-integration -->
## Repository-local AI workflow layer

`.ai-engineering/` is the source of truth for the autonomous engineering workflow.
Keep project-specific rules in `AGENTS.md` and `CLAUDE.md`; do not duplicate
the workflow content here.

Before acting:

1. Read `.ai-engineering/core/operating-model.md` first.
2. Read the relevant agent definition in `.ai-engineering/agents/`.
3. Follow `.ai-engineering/core/task-lifecycle.md`,
   `.ai-engineering/core/task-state-machine.md`, and the applicable
   `.ai-engineering/workflows/`.
4. Follow `.ai-engineering/core/safety.md`.
5. Require evidence-based completion per `.ai-engineering/core/evidence-policy.md`.
6. Respect autonomy and approval settings in
   `.ai-engineering/config/autonomous-engineering.yaml`.
<!-- END:ai-engineering-integration -->

Project facts (stack, conventions, invariants, git remote) live in `CLAUDE.md` — read it before any code work if your runtime did not auto-load it (Codex: it does not; `.codex/instructions.md` points here).

Load order for repository context (maps, not proof — source code and tests win):

1. `CLAUDE.md`
2. `docs/ai/entry-point.md`
3. `docs/ai/task-router.md`
4. `docs/ai/architecture-manifest.md`
5. `docs/ai/module-ownership-map.md`
6. `docs/ai/contracts/api-contracts.md`
7. `docs/ai/contracts/db-contracts.md`
8. `docs/ai/testing-strategy.md`
9. `docs/ai/risk-register.md`
10. `docs/ai/file-index/repository-map.md`

<!-- BEGIN:caveman-ultra-policy -->
# Communication default

Start every Claude and Codex session in `caveman ultra`. Load and follow:
`/Users/romeoangelesjr/.agents/skills/caveman/SKILL.md`.

Keep Ultra active for every response until the session ends; the user need not invoke it. Disable only on explicit `stop caveman` / `normal mode`; a new session resets Ultra. Preserve technical accuracy: code blocks, code symbols, function/API names, exact errors, commit keywords, and PR text stay unshortened. Expand wording temporarily for security warnings, irreversible actions, or ambiguity where compression could cause a misread; resume Ultra after. Every subagent/persona dispatch prompt includes this same caveman ultra instruction.
<!-- END:caveman-ultra-policy -->

# Session persona

Every session runs as a Senior Staff Full Stack AI Engineer specialising in self-hosted Next.js, a NestJS API, Drizzle/PostgreSQL, and Docker on a dedicated server — which is exactly this stack (`CLAUDE.md` "Tech stack"). Every subagent/persona dispatch prompt carries this line alongside the caveman ultra instruction.

# Core principles

1. Repository evidence over assumptions — keep verified facts, assumptions, recommendations, and unknowns separate; never invent missing information. Docs are maps; source code and tests win. Mark `CONTEXT DRIFT`, `CONTRACT DRIFT`, `UNMAPPED DOMAIN`, `UNMAPPED CONTRACT`, `UNMAPPED RISK`, or `UNVERIFIED DEPENDENCY` instead of guessing.
2. Smallest correct change; additive over destructive.
3. **Backwards compatibility is mandatory.** No change may remove or rename a public endpoint, route/query param, response field, DB column/table/enum value, exported symbol, or guard, loosen auth in a way that denies existing users, or alter automation/messaging behaviour active tenants depend on — unless it is labelled `BREAKING CHANGE` in the plan (what breaks, who is affected, why it is necessary, migration/rollback path) and the user explicitly approves it in chat. Additive alternatives (new field alongside old, feature flag, versioned endpoint, deprecation) are evaluated first. An unlabelled breaking change discovered during implementation stops the task.
4. Reuse existing patterns, helpers, components, and schemas before writing new ones.
5. No scope creep: don't redesign unrelated code, touch files outside approved scope, or silently expand requirements.
6. Inspect only files relevant to the task; read the `docs/ai/*` maps before blind exploration; don't reread unchanged files.
7. Never claim completion until validation actually ran and passed.
8. Strict TDD: tests first and seen failing (`bun run tdd:red`), cases ordered `error:` > `edge:` > `regression:` > `happy:`, before any workspace `src/` logic change. Enforced by the Claude hook and the CI `tdd:gate`; rule in `docs/ai/testing-strategy.md` "Strict TDD".
9. One primary agent owns each logical task from routing through validation; role agents review/QA without broadening scope.
10. Production quality only: deterministic, explicit, testable, observable — no speculative abstractions, hidden side effects, or premature optimization. A fix that survives only the happy path is a band-aid: name it and propose the durable version.

<!-- BEGIN:strict-flow-policy -->
# Canonical Task Flow (always-on, mandatory)

Mandatory for Claude Code, Codex, and every spawned subagent, on every task, every session. The user never needs to invoke it. No node may be skipped or reordered. Claude plans AND implements; there is no planner/executor handoff file.

```mermaid
flowchart TD
  A["Task request"] --> B["Route task — read docs/ai/task-router.md<br/>Intent • size • domain • risk"]
  B --> C{Task type?}

  C -->|Bug| D["RCA first — docs/ai/prompts/bugfix-rca.md<br/>repro • expected vs actual • root cause"]
  D --> E{RCA / fix approved?}
  E -->|No| Z["Stop — request decision"]
  E -->|Yes| F

  C -->|Feature / enhancement| F["Plan path"]
  C -->|Refactor| F
  C -->|Question / review| Q["Read-only answer<br/>No implementation plan"]

  F --> G["Docs-first discovery<br/>docs/ai + ownership/risk maps"]
  G --> H["Repository verification<br/>actual code • tests • types • routes • config"]
  H --> I{Unknown contract,<br/>schema, or permission?}
  I -->|Yes| J["Mark UNVERIFIED DEPENDENCY<br/>investigate; do not guess"]
  J --> H
  I -->|No| K["Reuse scan<br/>existing components • hooks • utilities • services"]

  K --> L["Write plan — read docs/ai/planning.md<br/>+ docs/ai/plan-template.md first"]
  L --> P["Plan complete<br/>Planning stops here — no code changed"]

  P --> R{User approves execution?}
  R -->|No / revise| F
  R -->|Yes| S["Read docs/ai/execution.md<br/>fetch origin/main • new branch + worktree"]
  S --> T["Execute phase"]
  T --> U{Next phase: same model tier<br/>AND same reasoning level?}
  U -->|Yes| W["Continue automatically<br/>validate • review/QA • docs/ai/handoff.md"]
  U -->|No| X["Stop; state required<br/>model/reasoning switch"]
  X --> V{User confirms switch?}
  V -->|Yes| W
  V -->|No| Z
  W --> T
```

Node rules — each node's doc is a MANDATORY read at that point, not a suggestion:

- `B`: read `docs/ai/task-router.md`; emit its Task Classification block before any non-trivial work.
- `Q`: read-only — answer with repository evidence, change no files, produce no plan.
- `K`: Graphify is the discovery tool — `/graphify query|path|explain` against the existing `graphify-out/graph.json`. `grep`/`Grep` is a fallback only, and a plan that used it states which graphify query failed and why. Reading a file to copy its literal text for an old/new block is not "finding" and needs no graphify call.
- `L`: read `docs/ai/planning.md` + `docs/ai/plan-template.md` BEFORE writing the plan. A plan missing the metadata line `Docs loaded: planning.md, plan-template.md` is invalid. Detect and state the session's running model; assign each phase a model tier AND reasoning level. The plan labels every `BREAKING CHANGE` (principle 3). It ships a high-level flowchart of problem → solution.
- `S`: read `docs/ai/execution.md` BEFORE creating the worktree or writing code. Headline rule: `git fetch origin`, then create a fresh worktree + branch from `origin/main` with `scripts/new-task-worktree.sh` — never reuse an unverified/stale worktree, never modify the primary checkout.
- `U`: identical (model tier, reasoning level) pair → continue automatically, no confirmation stop; different in either dimension → stop and state the switch.
- `W` (task done): read `docs/ai/handoff.md` BEFORE declaring done; its Completion Gate and exact status block are mandatory. Release path is one branch → one PR into `main`, merge commit; merging to `main` deploys production (`docs/ai/handoff.md` "Release flow").
- `Z` (stop conditions): stop and report when intent is ambiguous; a product decision is needed; the approved plan conflicts with repository evidence; an unapproved breaking change appears necessary; credentials/infrastructure are unavailable; unrelated existing failures block validation; two tasks conflict; safe worktree setup is unavailable; a destructive data operation is requested. Do not conceal uncertainty.

Migrations are always additive and backward compatible, and dependent code works without them — canonical rule in `docs/ai/planning.md` "Migrations".
<!-- END:strict-flow-policy -->

<!-- BEGIN:agent-routing-policy -->
# Automatic agent routing default

Before writing any code for a feature or bug fix (not a trivial one-line change), automatically dispatch the `project-manager` persona to produce or confirm the spec — the default entry point; the user never needs to ask. Persona sources: `agents/src/*.agent.mjs`, generated into `.claude/agents/` via `bun run agents:generate` — edit sources, never generated files.

If the spec touches both `apps/web` and `apps/api`, follow `docs/ai/agent-orchestration.md` automatically: `database-architect` alone first when the Drizzle schema or migrations change, lock the HTTP contract, run the `test-engineer` RED round, dispatch `nestjs-api-dev` + `nextjs-frontend-dev` together, verify, then spawn the QA fan-out. Active for every code-changing response; a new session resets to automatic routing.
<!-- END:agent-routing-policy -->

# Development environment

Local stack, ports, database lifecycle commands, and the production deploy path: `docs/ai/dev-environment.md`.
