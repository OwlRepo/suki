# Testing Strategy

Purpose:

Map task size and risk to expected verification.

This file is map only.

Commands must be verified from package scripts or repo docs before being listed as valid.

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
5. If non-breaking: confirm in scratchpad as `Backwards Compatibility: None` or `Additive`.

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

