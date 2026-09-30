# Operating Contract (Compatibility Pointer)

The AI workflow is split by phase so each session loads only what it needs:

- Always-on core: `AGENTS.md` (Canonical Task Flow, core principles, backwards-compatibility rule, stop conditions).
- Project facts: `CLAUDE.md`.
- Routing + skills: `docs/ai/task-router.md`.
- Plan-time rules: `docs/ai/planning.md` + `docs/ai/plan-template.md`.
- Execute-time rules: `docs/ai/execution.md`.
- Handoff/integration: `docs/ai/handoff.md`.

This path remains so `docs/ai/*` navigation links do not break. Do not add duplicate or conflicting rules here.
