# Claude Runtime Rules

Claude follows the same operating model and owns each task end to end:

- routing and analysis
- planning (stops for approval)
- implementation in a dedicated worktree
- review and QA through the persona fan-out (`docs/ai/agent-orchestration.md`)

The PreToolUse hook (`.claude/settings.json`) enforces RED-before-code. Personas live in `.claude/agents/` (generated). All outputs follow agent contracts.
