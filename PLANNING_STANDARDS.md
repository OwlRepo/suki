# Planning Standards — moved

Canonical planning rules live in:

- `docs/ai/planning.md` — verification, phases/model-switch stop, Drizzle/Postgres
  discipline, migrations (canonical), backwards compatibility, scans, forbidden
  language, plan completion gate.
- `docs/ai/plan-template.md` — the canonical plan skeleton (TL;DR first,
  `Docs loaded:` canary, phase sections, validation, scans).

Both are MANDATORY reads before writing any plan (`AGENTS.md`, flow node L).

## Non-bypassable evidence gate

A plan may not assert a cause it has not tried to disprove. Every causal claim
names the evidence for it AND the observation that would falsify it; anything
unfalsifiable with the checks available today is labelled a hypothesis, not a
cause. A claim asserted and later disproved is recorded in the plan's
`Claims reversed while investigating` line, never silently replaced.

## Non-bypassable Graphify gate

Every implementation loads the `graphify` skill and runs `/graphify . --update`
after the final indexed source/document edit and before review, commit, and
handoff. Direct `graphify update .` is acceptable only for code-only changes
(the CLI shortcut performs AST extraction only). A task is incomplete if the
update is skipped, fails, or its graph diff and token-cost evidence are not
reviewed. Full rules: `docs/ai/planning.md` "Mandatory Graphify phase".
