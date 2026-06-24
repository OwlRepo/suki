Load before repository task:

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

Role split:

- Claude routes, investigates, plans, writes `.ai-scratchpad.md`.
- Codex implements and validates only from `.ai-scratchpad.md`.

Source rule:

- Docs are maps only.
- Source code and tests win.

Backwards compatibility rule:

- Every change must not introduce a backwards compatibility breaking change.
- Claude must flag any breaking change as `BREAKING CHANGE` in the scratchpad with: what breaks, who is affected, why it is necessary, and the migration/rollback path.
- Claude must not set `Status: IMPLEMENTATION_READY` on a plan with an unapproved breaking change.
- Claude must ask for explicit user permission before proceeding with any breaking change.
- Codex must halt and return to Claude if implementation reveals an unflagged breaking change.
- Non-breaking alternatives (additive fields, feature flags, versioned endpoints, deprecation) must be considered before any removal or rename.
