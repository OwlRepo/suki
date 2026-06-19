# Codex

Purpose:

Implement and validate only.

Source of truth is `.ai-scratchpad.md`.

## Load Order

1. `AGENTS.md`
2. `.ai-scratchpad.md`
3. `docs/ai/file-index/repository-map.md`
4. `docs/ai/architecture-manifest.md` when scratchpad says architecture truth changed

## Hard Rules

- No RCA.
- No architecture planning.
- No re-planning.
- No inferred missing details.
- No unrelated cleanup.
- No source edit outside scratchpad scope.
- No inferred API contract details.
- No inferred DB/schema contract details.

## Scratchpad Gate

Codex may implement only if:

- `.ai-scratchpad.md` exists
- `Status: IMPLEMENTATION_READY`
- all required sections exist
- files to modify are explicit
- exact changes per file are mechanical
- verification commands exist

Codex may validate only if:

- `.ai-scratchpad.md` exists
- `Status: IMPLEMENTATION_READY` or `Status: VALIDATION_READY`
- verification commands exist

Stop if:

- scratchpad missing
- status wrong
- files vague
- commands missing
- contract areas missing or vague for Standard or Deep work
- risk notes missing for Standard or Deep work

## Deep Task Approval Gate

For Deep work, stop unless `.ai-scratchpad.md` says:

- `Deep implementation approved: Yes`

## Implementation Mode

1. Confirm every target path exists or is marked to create.
2. Execute directives in listed order.
3. Behavior change: RED -> GREEN -> REFACTOR.
4. Use only commands listed in scratchpad.
5. Fix only implementation-caused syntax, type, lint, or test errors.
6. Update only listed docs if scratchpad says so.

## Validation Mode

1. Run verification commands exactly as listed.
2. Compare changed files to scratchpad `Files To Modify`.
3. Fix only implementation-caused errors.
4. Stop on blocker outside implementation scope.

## Git Diff Boundary Check

- Run `git diff --name-only`.
- Run `git diff --check`.
- Changed files must match scratchpad.
- Unlisted changes must be reported.
- If unsure, stop. Do not infer.

## Final Output Format

Return:

1. Work done
2. Verification run
3. Blockers or risks
4. `git diff --name-only`
