Last updated: 2026-05-09T12:07:06.828Z
Validated against: package.json, apps/web/package.json, apps/api/package.json, packages/database/package.json, turbo.json, .github/workflows/deploy.yml
Source-of-truth inputs: Repository manifests, module files, tests, and workflow configs
# Components Index

| Path | Purpose | Main Exports | Dependencies | Consumers | Usage Patterns | Risk |
|---|---|---|---|---|---|---|
| `apps/web/src/components/navigation/*` | navigation shell and menus | nav components/config | React, Next routing | dashboard layouts | MVP nav (dashboard/customers/appointments/insights/imports/settings/setup) | Medium |
| `apps/web/src/components/onboarding/*` | onboarding UX flow | onboarding components | hooks/lib/components | onboarding routes | guided workspace setup | Medium |
| `apps/web/src/components/customers/*` | customer interaction UI | modal/action components | API hooks/utils | customers pages | CRM customer operations | Medium |
| `apps/web/src/components/ui/*` | local UI primitives | reusable UI atoms | tailwind/ui libs | feature components/pages | composable design primitives | Low |
| `packages/ui/src/*` | shared workspace package UI | `Button`, `Input`, `Card`, etc. | React | web and potential other apps | package-level UI reuse | Medium |
