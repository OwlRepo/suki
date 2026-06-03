# Models Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `packages/database/src/schema/index.ts` | Database schema exports | Imported by API/domain data access | Shared schema source |
| `packages/database/src/database.ts` | Database connection and client setup | Used by DB scripts/services | Query and transaction entry point |
| `packages/database/drizzle/0009_automation_schema.sql` | Automation schema migration | Used by scheduler/automation modules | Persist automation settings and events |
| `packages/database/drizzle/0016_org_billing_fields.sql` | Organization billing fields migration | Consumed by billing/org services | Billing state persistence |
| `packages/database/drizzle/0019_appointment_share_templates.sql` | Appointment template migration | Used by appointments/customers flows | Share template support |
| `packages/database/drizzle/0018_booking_holds.sql` | Booking hold lifecycle migration | Used by intake/appointments modules | Hold and release behavior |
| `packages/database/drizzle/0021_local_auth.sql` | First-party auth schema migration | Supports API auth service/session guard | Creates auth identities, OTP challenges, and session tables |
| `packages/database/drizzle/0022_free_caps_templates_email_metering.sql` | Free-mode cap and automation-template migration | Used by messaging/automation settings flows | Adds automation message templates and email usage cap tables |
| `packages/database/drizzle/0023_lemonsqueezy_freemium_billing.sql` | Lemon Squeezy freemium billing migration | Used by billing, organization, webhook, and credit-ledger flows | Adds provider-neutral subscription fields, verified booking credit tables, and reconciliation/event storage |
| `packages/database/drizzle/0024_billing_production_ready.sql` | Billing production-hardening migration | Used by billing, intake OTP abuse controls, and reconciliation workflows | Adds subscription pending-sync fields, refund-review resolution fields, hold resend-state fields, and `public_otp_send_events` audit storage |
| `packages/database/src/schema/index.ts` (`assistant_thread_memories`) | Assistant thread memory persistence schema | Consumed by `assistant-thread-memory.service` | Stores per-org/user/thread rolling summary and recent turn snapshots |
