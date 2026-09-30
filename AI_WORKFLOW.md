# AI Software Engineering Workflow — moved

The workflow rules live in phase-loaded docs so every session and subagent
dispatch pays only for the phase it is in:

- Always-on core (Canonical Task Flow, core principles, backwards-compatibility
  rule, stop conditions, caveman default, agent routing): `AGENTS.md`.
- Project facts (stack, conventions, git remote): `CLAUDE.md`.
- Task routing, classification enums, and skill mappings: `docs/ai/task-router.md`.
- Plan-time rules (verification, deterministic spec, forbidden language,
  completion gate, migrations, scans): `docs/ai/planning.md` + `docs/ai/plan-template.md`.
- Execute-time rules (worktree isolation, single-task rule, implementation,
  testing, review, QA): `docs/ai/execution.md`.
- Integration, docs sync, completion gate, final report: `docs/ai/handoff.md`.
- Autonomous layer (agents, lifecycle, safety): `.ai-engineering/`.
