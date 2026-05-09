# Performance Guidelines

- Avoid unnecessary rerenders in dashboard-heavy routes.
- Memoize expensive computed view models in hooks/components.
- Keep API responses bounded; prefer pagination/filtering over broad payloads.
- Avoid redundant server round-trips; reuse cached state where safe.
- In API services, minimize N+1 query patterns and repeated external calls.
- Add monitoring/logging around webhook and async processing hotspots.
