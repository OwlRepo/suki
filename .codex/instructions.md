# Codex

Codex follows the same workflow as Claude Code: there is no planner/executor
split and no handoff file.

## Load Order

1. `AGENTS.md` — Canonical Task Flow, core principles (including the
   backwards-compatibility rule), routing default, stop conditions.
2. `CLAUDE.md` — project facts (Codex does not auto-load it).
3. The phase doc for the current flow node: `docs/ai/task-router.md`,
   `docs/ai/planning.md` + `docs/ai/plan-template.md`, `docs/ai/execution.md`,
   `docs/ai/handoff.md`.

## Codex-specific notes

- There is no Codex PreToolUse hook: run `bun run tdd:red` yourself before any
  workspace `src/` logic change; the CI `tdd:gate` re-proves it on the PR.
- Personas are generated for Claude Code only (`.claude/agents/`); under Codex,
  read the matching `agents/src/prompts/*.md` when acting in a role.
