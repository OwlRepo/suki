# Dependency Graph

## Primary Backend Chain
Controller -> Guard/Pipe -> Service -> Database package -> SQL/Migrations

## Primary Frontend Chain
Route/Page -> Feature Component -> Hook/Lib -> API client -> Backend controller/service

## Representative Paths
- `customers page` -> `customer components` -> `web lib api` -> `customers.controller` -> `customers.service` -> db
- `messaging generate endpoint` -> `messaging.service` -> `ai-execution.service` -> external AI provider
- `billing checkout endpoint` -> `billing.service` -> Lemon Squeezy service/webhook lifecycle
