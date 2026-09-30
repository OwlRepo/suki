# Mandatory Pull Request Evidence

> Purpose: what evidence a PR must carry before it's ready for review, by change type.
> Load rule: read before creating any PR — pointed to from `docs/ai/handoff.md` Integration sequence step 7.
> Source of truth: this is a MAP. Where it asks for facts governed elsewhere (migrations, tests, backwards compatibility), that governing doc wins — this file only requires reporting those facts in the PR body.

A PR is not complete until its evidence matches its Change Type and has actually been produced — never claimed without having been run.

## Change Type

One or more of: `UI / user-facing` · `Backend / API` · `Database` · `Bug fix` · `Refactor` · `Performance` · `Infrastructure`.

This is a reviewer-facing tag on the diff, distinct from the routing classification in `docs/ai/task-router.md`.

## Evidence by Change Type

### 1. UI / user-facing

Attach a short screen recording of the flow (start state, actions, result, loading/error/responsive behaviour) walked live in the browser. GitHub has no CLI to attach video to a PR body: hand the file to the user (`SendUserFile`) and open the PR as a draft (`gh pr create --draft`) until it is attached. Component tests (vitest + Testing Library) remain the automated proof.

### 2. Backend, API, database, or logic-only

- The exact previous behavior and the exact new behavior.
- Tests added/updated, the exact command run, and the result.
- Example request/response for API changes, and the backwards-compatibility verdict per touched surface.
- Migration details when applicable, per `docs/ai/planning.md` "Migrations".
- Known risks and rollback steps.

Never include secrets, tokens, private client data, or production credentials.

### 3. Bug fixes without meaningful UI change

A regression test that fails before the fix and passes after it (the RED evidence), how the bug was reproduced, the root cause, and why the fix resolves it.

### 4. Refactors

No recording. Report `docs/ai/prompts/refactor-plan.md`'s behavior-preservation statement and the characterization tests; use `TDD-Waiver: refactor ...` so the CI gate proves the tests pass against the base.

### 5. Database migrations

Purpose, schema changes, backfill behavior, reversibility, rollback order, impact on existing data, compatibility with the currently deployed code, and verification queries/tests — or the `Migration-Waiver:` line with the manual verification.

### 6. Performance changes

Measured baseline, result after the change, measurement method, environment, tradeoffs. Never claim an improvement without measurable evidence.

### 7. Infrastructure / CI / workflow

Which workflow or config changed, what it now enforces, the local proof (commands + output), and the rollback (revert the file).

## Required PR structure

Title and summary are written in plain language for a non-technical reviewer, in Spanish AND English. No `Co-Authored-By` Claude trailer.

```
## Resumen (Español)
<qué cambia y por qué, en lenguaje sencillo>

## Summary (English)
<what changes and why, in plain language>

## Qué cambia / What changes
- <bullets a non-technical reviewer can follow>

## Cómo probar / How to test
- <steps>

## Change Type
- <one or more from the list above>

## Evidence
<the evidence required for this Change Type>

## Testing
- Commands executed and results (pre-existing failures named separately)

## TDD evidence
- Test Matrix (layer | required / not required | file)
- RED run: the `bun run tdd:red` output from before implementing
- Waiver lines, if any, each on its own line: `TDD-Waiver: <reason>`, `Migration-Waiver: <reason>` (the CI `tdd:gate` reads them from here)

## Risk
- Possible regressions · backwards compatibility · data impact · security impact

## Rollback
- Exact steps to safely revert the change
```

## Mandatory rules

- Do not claim a test passed without having run it.
- Never use a recording as a replacement for an automated test where one is possible.
- Never expose secrets or private data in PR evidence.
- If required evidence cannot be produced, leave the PR as a draft and report the exact blocker.
