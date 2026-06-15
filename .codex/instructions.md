# Codex Instructions

- Start with `AGENTS.md`.
- Load `docs/ai/entry-point.md` first.
- Use `docs/ai/architecture/code-map.md`, `docs/ai/architecture/feature-boundaries.md`, and `docs/ai/file-index/repository-map.md` before broad scans.
- Build deterministic plan before edits.
- For behavior change: write failing test first, then minimum code, then refactor.
- Verify path, symbol, imports, consumers, and related tests before edit.
- Prefer small reversible diffs.
- Ask for confirmation before high-risk changes.
- Update `docs/ai/file-index/repository-map.md` and affected `docs/ai/architecture/*` after code change.
- Run strongest safe verification after edits.
