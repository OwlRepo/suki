Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# Implementation Playbook

Plan before edit.

- WHAT: exact behavior or fix
- WHY: problem and impact
- WHERE: exact files
- WHEN: edit order
- HOW: code approach
- BEFORE/AFTER: if useful
- DEPENDENCY IMPACT: imports, modules, consumers
- RISK: LOW / MEDIUM / HIGH
- TEST PLAN: commands and target tests
- BEHAVIOR TEST MATRIX: happy path, edge path, failure path
- CODE FACTS: repo truths used for decision
- ROLLBACK: safe undo path

Scope:
- Small: 1-2 files, no contract move
- Medium: up to 5 files, localized behavior
- Large: more than 5 files or architecture impact

Medium or high risk review:
- architecture fit
- dependency direction
- API compatibility
- security
- performance
- test coverage
- rollback safety
