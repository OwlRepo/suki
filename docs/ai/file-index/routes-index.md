Last updated: 2026-05-03T11:29:53.965Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Routes Index

| Path | Purpose | Main Exports | Dependencies | Consumers | Usage Patterns | Risk |
|---|---|---|---|---|---|---|
| `apps/web/src/app/page.tsx` | marketing landing route | page component | UI components | anonymous users | public entry funnel | Low |
| `apps/web/src/app/(dashboard)/*/page.tsx` | authenticated product routes | page components | hooks/lib/api/auth | signed-in users | dashboard feature surfaces | High |
| `apps/web/src/app/onboarding/page.tsx` | onboarding route | page component | onboarding components/hooks | new workspaces | setup journey | High |
| `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx` | sign-in route | page component | Clerk | unauthenticated users | auth entry | High |
| `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx` | sign-up route | page component | Clerk | unauthenticated users | auth registration | High |
| `apps/web/src/app/intake/[businessId]/page.tsx` | public intake form | page component | API client | customers | external intake workflow | High |
| `apps/api/src/**/*.controller.ts` | REST API route surface | controller classes | Nest services/guards | web app + providers | API contract surface | High |
