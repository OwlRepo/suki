# Models Index

| File Path | Purpose | Relationships | Usage Patterns |
|---|---|---|---|
| `packages/database/src/schema/index.ts` | Database schema exports | Imported by API/domain data access | Shared schema source |
| `packages/database/src/database.ts` | Database connection and client setup | Used by DB scripts/services | Query and transaction entry point |
| `packages/database/drizzle/0009_automation_schema.sql` | Automation schema migration | Used by scheduler/automation modules | Persist automation settings and events |
| `packages/database/drizzle/0016_org_billing_fields.sql` | Organization billing fields migration | Consumed by billing/org services | Billing state persistence |
| `packages/database/drizzle/0019_appointment_share_templates.sql` | Appointment template migration | Used by appointments/customers flows | Share template support |
| `packages/database/drizzle/0018_booking_holds.sql` | Booking hold lifecycle migration | Used by intake/appointments modules | Hold and release behavior |
