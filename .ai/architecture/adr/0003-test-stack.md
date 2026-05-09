# ADR 0003: Vitest + Cypress Testing Strategy

## Status
Accepted

## Decision
Use Vitest for unit/integration tests and Cypress for web E2E.

## Consequences
- Fast feedback loops for service/component behavior
- Separate E2E coverage path for route-level UX flows
- TDD Red->Green->Refactor enforced for behavior changes
