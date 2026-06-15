Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Hallucination Prevention

- Read repo before claiming repo truth.
- Quote exact path before describing behavior.
- Read tests before changing behavior.
- Do not invent routes, env vars, scripts, packages, or flows.
- Verify command from manifest before writing command.
- If unsure, say unknown and inspect more.
- Prefer one short accurate doc over many stale docs.
