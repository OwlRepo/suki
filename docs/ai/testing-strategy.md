# Testing Strategy

Purpose:

Map task size and risk to expected verification.

This file is map only.

Commands must be verified from package scripts or repo docs before being listed as valid.

## Strict TDD

Enforced, not advisory: the local guard blocks the agent and the CI gate blocks the PR.

1. **RED before any implementation.** Write every test the task's Test Matrix requires, run `bun run tdd:red`, and see it fail. Commit the tests on their own as `test(<scope>): ...` before any workspace `src/` logic changes. `tdd:red` records the RED in `<git-dir>/tdd-red.json` (per worktree, never committed).
2. **Case order: `error:` > `edge:` > `regression:` > `happy:`.** Every new test title (`it(`/`test(`) starts with one of those prefixes and is declared in that order. A valid RED has at least one `error:`, `edge:` or `regression:` case failing, or a test file that cannot load yet because its module does not exist. Only `happy:` failing is not a RED.
3. **Then implement until green.** Implementers may add tests. They never weaken or delete a RED test without saying why in the PR.

What counts as guarded logic: `apps/web/src/**`, `apps/api/src/**`, `packages/*/src/**` `.ts`/`.tsx` files, excluding `*.test.*`, `*.spec.*`, `*.d.ts`, and `src/test/` setup folders (`scripts/ci/tdd-lib.mjs` `isGuardedSource`).

Enforcement:

| Where | What | Bypass |
|---|---|---|
| Claude session | `.claude/settings.json` PreToolUse hook `scripts/hooks/tdd-red-guard.mjs` blocks Edit/Write (and Bash `sed -i`, `>`, `tee`, `cp`/`mv`) on guarded logic until a valid RED marker exists for the current branch | `bun run tdd:red -- --waiver "<reason>"`, which then must appear in the PR as `TDD-Waiver:` |
| Codex session | no project hook; `bun run tdd:red` is a mandatory step in `AGENTS.md` | CI gate below |
| Every PR | `bun run tdd:gate` (`scripts/ci/tdd-gate.mjs`, `.github/workflows/ci.yml`): tests present for changed logic; migration test for changed migrations; titles prefixed and ordered; **the PR's tests run against the merge-base code and must fail** (`TDD-Waiver: refactor ...` inverts this: they must pass there) | `TDD-Waiver:` / `Migration-Waiver:` lines in the PR body, all listed in the CI job summary |

How the runner works (`scripts/ci/tdd-runner.mjs`): web tests run in `apps/web`, API specs in `apps/api`, types specs in `packages/types` — each with `node_modules/.bin/vitest run --reporter=json` so the workspace's own `vitest.config.ts` applies; `scripts/**/*.test.mjs` run under `node --test`.

Known limits: the Bash guard is a heuristic; a human editing by hand bypasses the local guard (never the CI gate). There is no migration-test harness yet: a migration needs a test under `packages/database/tests/` or a `Migration-Waiver:` naming the manual verification. There is no Playwright suite: a `.tsx` change needs a vitest component test. Existing test files are grandfathered: only titles a diff adds are checked. Waivers are self-declared by the PR author and shown in the CI job summary, so review is where they get challenged.

## Mandatory Test Layers

| Diff touches | Required | Not required when |
|---|---|---|
| guarded `.ts` logic | unit/integration vitest test in the same workspace | never |
| guarded `.tsx` (user-visible) | vitest + Testing Library component test in `apps/web` or `packages/ui` | never |
| an API endpoint, webhook, scheduler, or provider adapter | integration spec with `@nestjs/testing` and mocked providers | pure function, no I/O |
| `packages/database/drizzle/*.sql` | migration test or `Migration-Waiver:` | never |
| any deployable change | smoke: `bun run build`, then local `bun run dev` walk-through; post-merge deploy health checks | docs-only diff |

Regression: a bug fix carries a test that fails on the pre-fix code (the RED) — it is the regression layer. A layer may be dropped only with an explicit waiver line in the plan naming the layer and the reason.

## Targeted Runs

Verify a change by running ONLY the tests for what you touched, from the owning workspace:

- `cd apps/api && ../../node_modules/.bin/vitest run src/billing/billing.service.spec.ts`
- `cd apps/web && ../../node_modules/.bin/vitest run src/lib/api.test.ts`
- `node --test scripts/ci/tdd-lib.test.mjs`

Whole-suite `bun run test` is for pre-PR validation. Compare against the baseline on `origin/main`: failures that pre-exist there are reported, not attributed to the task.

## Task Matrix

| Task Size | Minimum Verification | Extra Verification | Manual QA | Notes |
|---|---|---|---|---|
| Tiny | targeted read-through or formatting check | none | visual/read-through | no behavior change; confirm no public API surface is touched |
| Express | targeted type/lint/test if available | related test if available | focused flow | single-layer change; confirm additive or internal-only |
| Standard | verified type/lint/test/build commands if available + related tests; **backwards compat gate** | regression test when relevant | affected workflow | FE-BE or multi-file changes; flag any contract shape change |
| Deep | verified type/lint/test/build commands if available + regression tests; **backwards compat gate required** | migration/payment/job/webhook/permission checks when relevant | full critical flow | billing/payments/auth/jobs/schema/transactions; label and get approval for any breaking change |

## Backwards Compatibility Verification Step

Apply at Standard and Deep task sizes (and any Express task that touches a public API or exported symbol):

1. List every public surface touched by the change (endpoints, route params, response fields, DB columns, exported symbols, auth guards, automation configs).
2. For each surface: is the change additive-only, or does it remove/rename/alter an existing value?
3. If any surface is removed/renamed/altered: run the Backwards Compatibility Gate from the relevant prompt template.
4. If breaking: label `BREAKING CHANGE`, explain impact and why additive alternative is not viable, stop and get user approval.
5. If non-breaking: record it in the plan metadata as `Backwards Compatibility: None` or `Additive`.

## Verified Commands

Root `package.json`:

- `bun run build`
- `bun run build:web`
- `bun run build:api`
- `bun run typecheck`
- `bun run lint`
- `bun run test`
- `bun run update:ai-indexes`
- `bun run check:assistant-context-governance`
- `bun run tdd:red`, `bun run tdd:gate` (needs `TDD_GATE_BASE`)
- `bun run test:scripts`
- `bun run agents:generate`, `bun run agents:lint`

Workspace packages:

- `apps/web`: `next build --webpack`, `tsc --noEmit`, `eslint .`, `vitest`, `vitest run`
- `apps/api`: `nest build`, `tsc --noEmit`, `eslint . --ext .ts`, `vitest`, `vitest run`
- `packages/database`: `tsc`, `tsc --noEmit`, `drizzle-kit generate`, `bun run scripts/{setup,migrate,seed,reset,reconcile-orphans}.ts`
- `packages/types`: `tsc --noEmit`, `vitest run` (script `test:run`; not part of `turbo run test`)

## Notes

- Do not invent commands not present in package scripts or repo docs.
- DB lifecycle commands are verified as existing. They are not automatically safe for task validation.
- For docs-only bootstrap work, targeted read-through plus `git diff --check` is enough unless repo documents stronger doc validation.

