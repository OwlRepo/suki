Last updated: 2026-05-03T11:29:53.965Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Implementation Playbook

## Plan Template
- WHAT: Exact behavior or fix
- WHY: Problem and impact
- WHERE: Exact files expected to change
- WHEN: Order of implementation
- HOW: Code-level approach
- BEFORE/AFTER: snippets when useful
- DEPENDENCY IMPACT: modules/imports/consumers
- RISK LEVEL: LOW/MEDIUM/HIGH
- TEST PLAN: commands + specific tests
- ROLLBACK: safe undo path

## Change Scope Limits
- Small: 1-2 files, no architecture change
- Medium: up to 5 files, localized behavior
- Large: >5 files or architecture impact, requires confirmation and phased execution

## Staff-Engineer Guard (Medium/High Risk)
Review before coding:
- architecture consistency
- dependency direction
- API compatibility
- security
- performance
- test coverage
- rollback safety
