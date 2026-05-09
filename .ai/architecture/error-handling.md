# Error Handling

## Strategy
- Nest exceptions are normalized through `HttpExceptionFilter`.
- Controllers/services throw typed HTTP exceptions for expected failure modes.
- External provider calls return explicit errors and status-aware failures.

## Logging
- Filter/service-level logging for operational visibility.
- Webhook and integration failures should include actionable diagnostics without leaking secrets.

## Test Expectations
- Error-handling changes must include error-path tests.
- Contract-visible error payload changes must include regression coverage.
