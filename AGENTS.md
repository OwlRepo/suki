For any development task consult AI documentation inside `docs/ai/`.

Before implementing changes:

1. Understand architecture from `docs/ai/architecture/code-map.md` and `docs/ai/architecture/feature-boundaries.md`
2. Locate files using `docs/ai/file-index/repository-map.md`
3. Discover existing tests before editing source files
4. Strictly follow TDD workflow inside `docs/ai/workflows/tdd-development.md`
5. Route task with `docs/ai/task-routing.md` and follow matching workflow inside `docs/ai/workflows/`
6. When maintaining file index, follow `docs/ai/workflows/update-file-indexes.md` (`git status` / changed paths, update only affected rows)

Always produce deterministic plan before modifying code.

Always write or update tests before implementation code unless task is documentation-only, formatting-only, comment-only, generated documentation-only, file-index-only, or explicitly non-code.

Do not implement production code before failing test exists.

For bug fixes, always add or update regression test that fails before applying fix.

After any code change, update affected `docs/ai/file-index/repository-map.md` and affected `docs/ai/architecture/*` entries before completion so AI context stays current.

No new npm package or dependency without human approval.

Never commit on `main` or `master`.

Use Conventional Commits.

Build, test, typecheck, or lint fail 3 times in row -> stop, print failure chain, ask human review.
