# ADR 0002: NestJS Controller-Service Pattern

## Status
Accepted

## Decision
Backend modules use controller-service-module separation with guards and global validation/filtering.

## Consequences
- Clear HTTP contract boundaries
- Easier testing at controller/service layers
- Guard/middleware changes are high-risk and must be test-first
