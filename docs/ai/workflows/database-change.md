Last updated: 2026-05-03T11:29:40.672Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Database Change Workflow

## When To Use
Use for Database Change tasks.

## Required Context Files
- `docs/ai/entry-point.md`
- `docs/ai/context-loading.md`
- relevant architecture docs
- relevant file indexes

## Required Inspection Steps
- verify target files and symbols
- inspect dependencies/consumers
- inspect related tests
- assess risk level

## Planning Requirements
- produce deterministic WHAT/WHY/WHERE/WHEN/HOW plan
- include dependency impact, risk, test plan, rollback

## Implementation Rules
- keep diff scoped
- preserve public contracts unless approved
- follow risk matrix and safety rules

## Verification Commands
- `bun run typecheck`
- `bun run lint`
- related tests then broader tests as needed

## Documentation Updates
- update impacted `docs/ai/file-index/*.md`
- update architecture docs for repeated patterns only

## Rollback Steps
- revert scoped commit or affected files
- restore compatibility and rerun verification
