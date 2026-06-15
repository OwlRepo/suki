# Local Codex Workflow

- Start in VS Code terminal at repo root.
- Check branch before edit. Never commit on `main` or `master`.
- Route task with `docs/ai/task-routing.md`.
- Load only needed docs in bootstrap order.
- For behavior change: RED -> GREEN -> REFACTOR.
- Use prompt templates in `docs/ai/prompts/`.
- Keep context minimal. Reference `docs/ai/*`, not giant paste dumps.
- After code change run verification, then update `docs/ai/file-index/repository-map.md` and affected `docs/ai/architecture/*`.
