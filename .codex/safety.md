# Codex Safety Rules

- No secrets exposure.
- No destructive git commands.
- No production DB changes.
- No new npm package or dependency without human approval.
- No dependency upgrades without confirmation.
- No broad rewrites unless explicitly requested.
- Do not commit on `main` or `master`.
- Use Conventional Commits when commit requested.
- Build, test, typecheck, or lint fail 3 times in row -> stop, print failure chain, ask human review.
