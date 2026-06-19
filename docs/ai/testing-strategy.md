# Testing Strategy

Purpose:

Map task size and risk to expected verification.

This file is map only.

Commands must be verified from package scripts or repo docs before being listed as valid.

## Task Matrix

| Task Size | Minimum Verification | Extra Verification | Manual QA | Notes |
|---|---|---|---|---|
| Tiny | targeted read-through or formatting check | none | visual/read-through | no behavior change |
| Express | targeted type/lint/test if available | related test if available | focused flow | single-layer change |
| Standard | verified type/lint/test/build commands if available + related tests | regression test when relevant | affected workflow | FE-BE or multi-file changes |
| Deep | verified type/lint/test/build commands if available + regression tests | migration/payment/job/webhook/permission checks when relevant | full critical flow | billing/payments/auth/jobs/schema/transactions |

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

Workspace packages:

- `apps/web`: `next build --webpack`, `tsc --noEmit`, `eslint .`, `vitest`, `vitest run`
- `apps/api`: `nest build`, `tsc --noEmit`, `eslint . --ext .ts`, `vitest`, `vitest run`
- `packages/database`: `tsc`, `tsc --noEmit`, `drizzle-kit generate`, `bun run scripts/{setup,migrate,seed,reset,reconcile-orphans}.ts`

## Notes

- Do not invent commands not present in package scripts or repo docs.
- DB lifecycle commands are verified as existing. They are not automatically safe for task validation.
- For docs-only bootstrap work, targeted read-through plus `git diff --check` is enough unless repo documents stronger doc validation.

