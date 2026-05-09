Last updated: 2026-05-09T08:25:19.556Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Risk Matrix

## LOW
- styles
- isolated UI components
- copy changes
- small utilities

## MEDIUM
- hooks
- services
- routes
- data fetching
- forms
- validation

## HIGH
- authentication/authorization
- database schema/migrations
- global state and shared utilities
- payment/billing logic
- security middleware
- API response contracts
- dependency upgrades
- build config and CI/CD

High-risk changes require explicit confirmation before implementation.
