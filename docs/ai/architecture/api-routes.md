Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Last updated: 2026-06-15T02:49:13.102Z
# API Routes

Route surface lives in `apps/api/src/**/*.controller.ts`.

Main domains:
- auth
- users / organizations / businesses
- customers / intake
- appointments
- onboarding / workflows / automation
- messaging / webhooks
- insights
- imports
- billing
- admin / AI
- licensing / privacy / health

Rules:
- inspect request and response shape before edit
- inspect consumers before breaking contract
- update tests when route behavior changes
