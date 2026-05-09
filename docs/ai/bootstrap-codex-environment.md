Last updated: 2026-05-09T12:07:06.828Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Bootstrap Codex Environment

## What this integration is
The Bootstrap Codex Environment integration standardizes AI operation around markdown docs.

- Canonical AI system: `docs/ai`
- Canonical flow start: `AGENTS.md` -> `docs/ai/entry-point.md`
- Legacy Cursor bootstrap workflow is removed (kept only as historical context)

## How it works
This repo keeps AI operating knowledge in markdown and uses one operational script:

1. `bun run update:ai-indexes`
- Runs `scripts/update-ai-indexes.ts`
- Updates metadata headers for `docs/ai/**/*.md` files
- Stamps/refreshes:
  - `Last updated:`
  - `Validated against:`
  - `Source-of-truth inputs:`

## How to use properly
Use this sequence for day-to-day operations:

1. Read `AGENTS.md`.
2. Follow `docs/ai/entry-point.md` for task routing and context loading.
3. Run `bun run update:ai-indexes` after meaningful AI docs updates so metadata stays current.

Expected outcomes:
- `update:ai-indexes` prints stamped markdown file paths under `docs/ai`.

Do:
- Keep operational docs in `docs/ai`.
- Treat script output as the source of operational truth for this integration.
- Refresh metadata after docs updates.

Do not:
- Maintain a parallel legacy AI-doc system outside `docs/ai`.

## Troubleshooting
### `bun run update:ai-indexes` fails with command/script errors
- Confirm you are at repo root: `/Users/romeoangelesjr/Documents/personal/suki`.
- Confirm Bun is installed and available: `bun --version`.
- Confirm scripts exist:
  - `scripts/update-ai-indexes.ts`

### Command runs but you do not see expected updates
- `update:ai-indexes` only updates markdown metadata headers in `docs/ai`.
- Re-run and inspect console output for `Stamped docs/ai/...` lines.
