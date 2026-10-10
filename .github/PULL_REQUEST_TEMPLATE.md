<!-- Plain English first: the reviewer may not be technical. No emojis. No Co-Authored-By trailer. Structure and evidence rules: docs/ai/pr-evidence.md -->

## Summary

<!-- 2-4 plain sentences: what problem existed and what this change does, as you would explain it to a non-technical teammate. -->

## What changes

-

## How to test

1.

## Gates checklist

<!-- CI runs tdd:gate, typecheck, changed-file lint, test:scripts, and agents:lint (when persona files change). This checklist covers what CI cannot check. -->

- [ ] QA run (`/qa` or `/qa-only`)
- [ ] Code review run (`ecc:code-review` or `/review`)
- [ ] Affected `docs/ai/*` files synced
- [ ] If a migration exists: backward compatible, and the code works without it
- [ ] No direct commits to `main`; branch created from `origin/main`

<!-- Below: technical evidence per docs/ai/pr-evidence.md. The summary above stays plain-language; this section is for verification. -->

## Change Type

-

## Evidence

## Testing

- Commands executed and results (pre-existing failures named separately)

## TDD evidence

- Test Matrix (layer | required / not required | file)
- RED run: the `bun run tdd:red` output from before implementing
- Waiver lines, if any, each on its own line (the CI `tdd:gate` reads them from this body):
  - `TDD-Waiver: <reason>`
  - `Migration-Waiver: <reason>`

## Risk

- Possible regressions
- Backward-compatibility concerns
- Data impact
- Security impact

## Rollback

- Exact steps to safely revert the change
