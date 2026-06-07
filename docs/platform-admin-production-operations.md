# Platform Admin Production Operations

Tyvera platform-admin pages are internal monitoring. Better Stack is external monitoring.

External monitoring detects complete outages such as the public site, sign-in page, or health endpoint being unavailable. Internal monitoring identifies affected customers, providers, scheduler jobs, communications, billing actions, and alerts after the application is reachable.

## Manual Better Stack Setup

Configure these uptime monitors manually in Better Stack:

- `https://tyvera.app`
- `https://tyvera.app/sign-in`
- `https://tyvera.app/api/health`

Heartbeat candidates for a later approved implementation:

- `appointment-reminders`
- `inactivity-winback`
- `semaphore-reconciliation`
- `database-backup`

Do not add heartbeat network calls to application code until that integration is explicitly approved.

## Internal Monitoring Checklist

- Use `/platform-admin` for the internal overview.
- Use `/platform-admin/communications` to review SMS and email delivery failures, masked recipients, and manual follow-up context.
- Use `/platform-admin/automation-runs` to review appointment reminders, inactivity winback, and Semaphore reconciliation runs.
- Use `/platform-admin/alerts` to acknowledge or resolve provider-credit, delivery-spike, OTP, and missing-run alerts.
- Use `/platform-admin/audit-logs` to inspect sensitive platform-admin actions.

## Sentry Recommendation

Sentry is a future optional integration for:

- `apps/web`
- `apps/api`

Recommended future scope:

- unhandled frontend errors
- NestJS exceptions
- webhook-handler exceptions
- scheduler exceptions
- Semaphore request failures

Do not capture:

- OTP codes
- full mobile numbers
- full email bodies
- payment-proof content
- provider API keys

No Sentry integration code is included in this PR.

## Rollout Sequence

1. Back up PostgreSQL.
2. Deploy application code.
3. Run `bun run db:migrate`.
4. Run `bun run db:seed-platform-admin-rbac`.
5. Bootstrap the existing founder account.
6. Sign in as founder.
7. Run the production smoke test.
8. Configure Better Stack manually.
9. Monitor logs, provider health, alerts, and communications.

## Rollback Rules

1. Stop using `/platform-admin`.
2. Roll back the application image.
3. Keep additive migrations unless they cause a confirmed issue.
4. Do not delete platform-admin tables during emergency rollback.
5. Restore PostgreSQL only if data corruption occurred.
6. Verify customer-facing `/admin/*` routes and messaging flows.
