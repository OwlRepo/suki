# Suki rename compatibility audit

Suki is the app name; `suki.tyvera.app` is its configured application host. Tyvera remains the parent domain. This change does not perform a production hostname or infrastructure cutover.

## Intentionally retained references

- `tyvera_session`: accepted only as a legacy cookie fallback when `suki_session` is absent. New sessions use Suki; sign-out revokes supplied sessions and clears both cookie names. Host changes can require signing in again.
- `tyvera-sidebar-collapsed-v1`, `tyvera_dev_*`, `tyvera-onboarding-events`, `tyvera:intake:*`, and assistant local/session storage keys: legacy preference/data reads. Canonical Suki keys take precedence; normal writes use Suki. Explicit clearing of development overrides clears both namespaces.
- `tyvera-assistant.tsx` and `TyveraAssistant`: legacy module/export compatibility; the implementation and internal callers use `suki-assistant.tsx` and `SukiAssistant`.
- `auto_tyvera`: existing stored messaging actor identifier and database default. No data/schema migration is included.
- ` Sent automatically by Tyvera`: recognized for reconciliation of previously sent messages. New sender branding uses Suki.
- PostgreSQL database `tyvera`, server and backup directories, backup filename patterns, `tyvera-base`, `tyvera-api`, and `tyveraacr.azurecr.io`: existing deployment/infrastructure identities, retained until a separately approved migration.
- Historical SQL/migration snapshots and approved plans retain their evidence. Graphify contains derived historical evidence from these sources.
- Tests pin the legacy compatibility behavior. The governance test rejects other unexplained legacy application text and package names.

## Renamed together

Application text, metadata, accessibility labels, assistant identity, auth/booking/billing email branding, workspace package names and imports, build filters, lockfile references, documentation, examples, and generated agent definitions use Suki. App-generated canonical links use `suki.tyvera.app`; live provider registrations and secret environment values were not changed.

No endpoint, payload shape, tenant guard, payment permission, automation schedule, existing record, or migration was removed by the rename.
