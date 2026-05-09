# Risk Matrix

## LOW
- UI component rendering/styling
- localized utilities without shared side effects

## MEDIUM
- hooks, routes, controllers, services with module-local behavior

## HIGH
- authentication/authorization
- database schema/migration/query contracts
- global/shared utilities and guards
- billing, messaging webhooks, AI policy/rate-limit/concurrency
- external API contract changes

## High-Risk Gate
Before implementation: assess dependency impact, security, performance, regression risk, rollback safety, and compatibility.
