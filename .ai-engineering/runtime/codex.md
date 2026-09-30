# Codex Runtime Rules

Codex follows `AGENTS.md` exactly like Claude Code (`.codex/instructions.md`).

Codex should:

- read `AGENTS.md`, then `CLAUDE.md` (not auto-loaded under Codex)
- inspect before editing
- act in the role described by the matching `agents/src/prompts/*.md` (personas are generated for Claude Code only)
- run `bun run tdd:red` itself before workspace `src/` logic changes (no Codex hook)
- keep tasks isolated in their own worktree
- provide structured evidence
- create focused changes
