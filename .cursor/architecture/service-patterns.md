# Service Patterns

## NestJS Structure

- **Modules**: Group related controllers and services
- **Controllers**: Handle HTTP, delegate to services
- **Services**: Business logic

## Example

HealthController uses getDb() directly. For complex logic, create dedicated services.
