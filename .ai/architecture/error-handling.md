# Error Handling

## Strategy
- Nest exceptions are normalized through `HttpExceptionFilter`.
- Controllers/services throw typed HTTP exceptions for expected failure modes.
- External provider calls return explicit errors and status-aware failures.

## Logging
- Filter/service-level logging for operational visibility.
- Webhook and integration failures should include actionable diagnostics without leaking secrets.
- Global 5xx exception logging includes only bounded safe nested-cause fields (`name`, `message`, `code`, `detail`, `hint`, `where`, `cause`) so hidden driver errors are diagnosable without expanding client responses.

## Test Expectations
- Error-handling changes must include error-path tests.
- Contract-visible error payload changes must include regression coverage.
- Twilio webhook requests with missing or invalid signatures must fail authorization before mutating consent or delivery state.
- Ambiguous Twilio outbound network failures are treated as `provider_outcome_unknown` and are not auto-retried to reduce duplicate-SMS risk.
