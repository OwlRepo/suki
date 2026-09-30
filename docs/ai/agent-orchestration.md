# Agent Orchestration

> Purpose: how `project-manager` dispatches `nestjs-api-dev` + `nextjs-frontend-dev` together for one feature, what each agent may touch, and the round structure.
> Load rule: read when a spec touches both `apps/web` and `apps/api`, before dispatching anyone.
> Source of truth: this is a MAP. `agents/src/*.agent.mjs` (generated into `.claude/agents/*.md` via `bun run agents:generate`) is the executable source. If this doc and a generated agent file disagree, the generated file wins — fix this doc in the same change. `scripts/generate-agent-defs.test.mjs` fails when an `ownedGlobs` entry is missing here.

## Roster

| Persona | Role | Writes files? |
|---|---|---|
| `project-manager` | spec, contract lock, dispatch, verification | plan/spec only |
| `database-architect` | Drizzle schema + migrations | yes (owned globs below) |
| `nextjs-frontend-dev` | web UI | yes (owned globs below) |
| `nestjs-api-dev` | API + shared contract types | yes (owned globs below) |
| `test-engineer` | RED tests, coverage | test files only |
| `ui-ux-designer` | copy, empty states, UX polish | UI copy in web files, via the dispatcher |
| `code-reviewer`, `security-auditor`, `accessibility-auditor` | validators | no (read-only) |

All personas use the Claude `sonnet` model alias; model selection lives only in `agents/src/*.agent.mjs`. Personas are generated for Claude Code only (`.claude/agents/`).

## File Ownership Rule (FE-agent + BE-agent, same worktree)

For one feature dispatch, `nestjs-api-dev` and `nextjs-frontend-dev` work in the SAME worktree. To prevent concurrent writes to the same file:

1. **FE-agent** (`nextjs-frontend-dev`) may create or edit: `apps/web/src/app/**`, `apps/web/src/components/**`, `apps/web/src/hooks/**`, `apps/web/src/contexts/**`, `apps/web/src/lib/**`, and shared components in `packages/ui/src/**`.
2. **BE-agent** (`nestjs-api-dev`) may create or edit: `apps/api/src/**` (controllers, services, guards, DTOs, modules) and the shared contract types in `packages/types/src/**`.
3. **Shared/boundary files:** any type consumed by BOTH agents lives in `packages/types/src/**` and is owned by BE-agent, since BE-agent owns the locked contract. FE-agent only imports it. If FE-agent needs a shape change, it asks the master (`project-manager`), which re-issues the contract lock.
4. **Database** (`database-architect`, dispatched sequentially BEFORE the contract lock, never inside the concurrent pair): `packages/database/src/schema/**`, `packages/database/drizzle/**`, `packages/database/scripts/**`, `packages/database/drizzle.config.ts`.
5. **Tests:** during the RED round `test-engineer` alone writes `*.test.ts(x)` / `*.spec.ts` files in any workspace and `scripts/**/*.test.mjs`; afterwards implementers may add tests next to the code they own but never weaken a RED test.
6. If a spec would require FE-agent and BE-agent to touch the same file, the spec is defective: split it or reassign that file before dispatch. The master agent catches this during contract lock.

## Round Structure (Claude Code and Codex alike)

- **Round 0** (only if the Drizzle schema changes): `database-architect` alone. Wait for completion.
- **Round 1:** the orchestrator (`project-manager`) locks the HTTP contract itself — route, DTO, response shape, error statuses, `packages/types` type.
- **Round 1b — RED:** `test-engineer` alone with the locked contract and the plan's Test Matrix. It writes every required test (`error:` > `edge:` > `regression:` > `happy:`), runs `bun run tdd:red`, commits `test(<scope>): ...`, and reports the failing output. Round 2 does not start until that RED is recorded (`docs/ai/testing-strategy.md` "Strict TDD").
- **Round 2:** `nestjs-api-dev` and `nextjs-frontend-dev` together in one call.
- **Round 3:** the orchestrator verifies FE+BE output against the locked contract and acceptance criteria itself.
- **Round 4 (QA fan-out):** `test-engineer`, `code-reviewer`, `security-auditor` together — always, on every feature. Add `accessibility-auditor` when the diff touches user-facing UI; add `ui-ux-designer` when it touches UI copy/UX. This is the ONE canonical QA roster. Browser/manual QA uses the `/qa` skill, not a persona.

Never collapse Round 0/1, Round 2, or Round 3 into one dispatch.

## Global Policy block

`scripts/generate-agent-defs.mjs` appends `GLOBAL_POLICY` to every persona: caveman ultra replies, the persona line, graphify-first discovery, `AGENTS.md` flow adherence with the `docs/ai/planning.md` / `docs/ai/execution.md` phase loads, strict TDD, `.ai-engineering` reads, backwards compatibility, and the migration rule. Edit the policy in the generator, never in `.claude/agents/*.md`, then run `bun run agents:generate`.
