# Architecture Decision Record

Append one entry per decision (template: `templates/adr.md`).

## 2026-10-01 — Single-agent flow replaces the planner/executor split

Decision: Claude Code plans AND implements every task through the `AGENTS.md` Canonical Task Flow; the `.ai-scratchpad.md` handoff to Codex is retired. Personas are generated for Claude Code only.

Context: the previous setup made Claude planner-only and Codex the only implementer, with a scratchpad gate and a settings deny list. The user chose to run the whole flow in one agent (`docs/plans/infra-workflow-port-v2.md`).

Alternatives: keep the split; hybrid (Claude implements low-risk work only).

Tradeoffs: one owner per task and enforced TDD/CI gates, at the cost of the second-agent review that the split provided — replaced by the Round 4 QA fan-out (`docs/ai/agent-orchestration.md`).

Result: autonomy Level 2 (implement + open PR, never merge).
