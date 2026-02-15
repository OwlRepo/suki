# API Integration

## Frontend

- **Client**: Native fetch (or add Axios if preferred)
- **Base URL**: Configure via env (NEXT_PUBLIC_API_URL)
- **Auth**: Pass Clerk token in Authorization header when calling API

## Backend

- **NestJS REST controllers**: Use @Controller, @Get, @Post, etc.
- **Auth**: Validate Clerk JWT in guards (when implemented)
- **Database**: Inject or use getDb() from @suki/database

## Endpoints

- `GET /health` - Health check
- `GET /health/db` - Database connectivity check
