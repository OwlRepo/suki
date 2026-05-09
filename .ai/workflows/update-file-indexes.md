# File Index Update Workflow (LLM-Driven)

## Purpose
Maintain `.ai/file-index/*.md` incrementally using repository change truth.

## Triggers
- initial index setup
- after substantive code edits
- when user requests index refresh

## Required Procedure
1. Run `git status` in repo root.
2. Use `git diff --name-only` as needed to include staged + unstaged paths.
3. Map changed paths to affected index shards only.
4. Update only stale index files:
   - add/remove rows
   - correct path/purpose/relationships/usage patterns
5. Do not rewrite unrelated index shards unless a full refresh is required (for example large-scale rename).

## Path-to-Index Mapping Rules
- `apps/web/src/components/**` -> `components-index.md`
- `apps/web/src/hooks/**` -> `hooks-index.md`
- `apps/web/src/app/**` and API route handlers -> `routes-index.md`
- `apps/api/src/**/controller*.ts` -> `controllers-index.md`
- `apps/api/src/**/service*.ts` -> `services-index.md`
- `packages/database/**` schemas/models -> `models-index.md`
- `apps/**/src/**` general coverage -> `src-index.md`
- shared helpers (`utils`, `lib`, `common`) -> `utils-index.md`
- state modules (`store`, `state`, context providers) -> `stores-index.md`

## Quality Gate
Before finalizing index updates:
- verify every referenced path exists
- verify relationships reflect current imports/usage
- verify no unrelated shards were modified
