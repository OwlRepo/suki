For any development task consult the AI documentation inside `.ai/`.

Before implementing changes:

1. Understand architecture from `.ai/architecture`
2. Locate files using `.ai/file-index`
3. Discover existing tests before editing source files
4. Strictly follow the TDD workflow inside `.ai/workflows/tdd-development.md`
5. Follow workflows inside `.ai/workflows`
6. When maintaining file indexes, follow `.ai/workflows/update-file-indexes.md` (LLM-driven: `git status` / changed paths, then update only affected index files)

Always produce a deterministic plan before modifying code.

Always write or update tests before implementation code unless the task is documentation-only, formatting-only, comment-only, generated documentation-only, file-index-only, or explicitly non-code.

Do not implement production code before the failing test exists.

For bug fixes, always add or update a regression test that fails before applying the fix.
