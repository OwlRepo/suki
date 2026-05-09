# TDD Development Workflow (Mandatory)

## 1) Identify Task Type
Classify as one of:
- feature
- bug fix
- refactor
- API change
- database change
- UI behavior change
- validation change
- authentication or authorization change
- error handling change
- state management change

## 2) Locate Related Source
Use in order:
- `.ai/architecture/code-map.md`
- `.ai/architecture/feature-boundaries.md`
- `.ai/file-index/`

## 3) Locate Related Tests
Search:
- `__tests__/`
- `tests/`
- `*.test.ts`, `*.spec.ts`
- framework-specific folders (RTL, Vitest, Cypress, Nest testing, Supertest)

## 4) RED
- Write/update the smallest failing test first.
- Bug fix: reproduce with regression test.
- Feature: encode expected behavior.
- Refactor: confirm behavior coverage before structural changes.
- API change: test request and response behavior.
- Validation change: test valid and invalid paths.
- Auth change: test allow/deny behavior.
- Confirm failure is for the correct reason.

## 5) GREEN
- Implement the minimum code to satisfy the failing test.
- Avoid unrelated edits and premature abstractions.
- Keep scope constrained to tested behavior.

## 6) REFACTOR
- Improve naming/structure/duplication only after GREEN.
- Keep tests passing continuously.
- If behavior changes, return to RED first.

## 7) Verification Order
1. Run targeted test for changed behavior.
2. Run related suite.
3. Run type-check.
4. Run lint.
5. Run build (when applicable).

## 8) Completion Report
Include:
- tests added/updated
- implementation files changed
- verification commands run
- unrun tests and reasons
- any TDD limitation encountered

## TDD Exceptions
TDD may be skipped only for:
- documentation-only
- formatting-only
- comment-only
- file-index updates
- generated AI documentation updates
- non-behavioral configuration updates

If test setup is missing:
1. State no usable test setup was detected.
2. Identify missing test infrastructure.
3. Propose smallest viable setup.
4. Ask before introducing a new framework.
