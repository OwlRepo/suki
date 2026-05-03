Last updated: 2026-05-03T11:29:25.639Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Update File Indexes Workflow

## When To Use
- after substantive code edits
- after file moves/renames
- after new features/modules
- during AI docs audit passes

## Drift-Detection Steps
1. Run `git status`.
2. Run `git diff --name-only` (or inspect target branch diff).
3. Scan source-of-truth inputs:
   - manifests (`package.json` root + workspaces)
   - scripts (`scripts/*.ts`)
   - controllers/services/tests (`apps/**/src`)
   - route files (`apps/web/src/app`)
4. Map changed files to affected indexes (`docs/ai/file-index/*.md`) and architecture docs when needed.
5. Update only stale sections; keep unaffected sections unchanged.
6. Add entries for new files; remove entries for deleted files.
7. For unverifiable data, mark as `Not detected`.
8. Stamp freshness metadata.

## Required Entry Fields
- file path
- purpose
- main exports
- dependencies
- consumers
- usage patterns
- risk level

## Verification
- Ensure index entries point to existing paths.
- Ensure entries stay concise and navigation-focused.
- Ensure no source-code dumps are added.
