# Usage-Based API Platform

A TypeScript/Node.js take-home implementation of a small usage-based API platform. It supports deployment lifecycle management, API-key authentication, mocked completions, rate limiting, usage metering, and billing aggregation.

The implementation is intentionally simple and reviewable. It is not intended to be production-ready.

## Tech Stack

- Node.js, Express 5
- TypeScript with `strict` mode
- MongoDB with Mongoose
- Swagger UI via `swagger-ui-express`
- Vitest and Supertest for integration tests

## Setup & Run

Prerequisites:

- Node.js 22+
- npm
- MongoDB running locally, or a MongoDB connection URI

Run locally:

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run dev
```

By default the API runs on `http://localhost:4000`.

Swagger UI is available at:

```text
http://localhost:4000/docs
```

## Environment Variables

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/usage-based-api
NODE_ENV=development
```

Tests use `TEST_MONGODB_URI` when provided, otherwise:

```text
mongodb://localhost:27017/usage-based-api-test
```

## Project Overview

The API lets a user create a deployment for `model-a` or `model-b`. New deployments start in `provisioning`, then transition asynchronously to `ready` after approximately 10 seconds. Ready deployments expose an `endpoint_url` and `api_key`.

Completion requests require Bearer authentication. Successful requests return a mocked completion, calculate input/output tokens, and persist a usage event. Usage can then be queried by API key over a date range and grouped by day or model.

## API Endpoints

All API endpoints are mounted under `/api`.

| Method | Path                             | Description                   |
| ------ | -------------------------------- | ----------------------------- |
| GET    | `/health`                        | Health check                  |
| POST   | `/deployments`                   | Create a deployment           |
| GET    | `/deployments/:id`               | Fetch deployment status       |
| DELETE | `/deployments/:id`               | Mark deployment as terminated |
| POST   | `/v1/:deployment_id/completions` | Create a mocked completion    |
| GET    | `/usage`                         | Query usage and billing data  |

## Example Requests/Responses

Create a deployment:

```bash
curl -X POST http://localhost:4000/deployments \
  -H "Content-Type: application/json" \
  -d '{"model":"model-a"}'
```

```json
{
  "deployment_id": "dep_lx123abc_0123456789abcdef",
  "status": "provisioning"
}
```

Fetch a ready deployment:

```bash
curl http://localhost:4000/deployments/dep_lx123abc_0123456789abcdef
```

```json
{
  "deployment_id": "dep_lx123abc_0123456789abcdef",
  "status": "ready",
  "model": "model-a",
  "endpoint_url": "https://api.example.com/v1/dep_lx123abc_0123456789abcdef",
  "api_key": "generated-api-key",
  "created_at": "2026-09-17T10:00:00.000Z",
  "updated_at": "2026-09-17T10:00:10.000Z"
}
```

Create a completion:

```bash
curl -X POST http://localhost:4000/v1/dep_lx123abc_0123456789abcdef/completions \
  -H "Authorization: Bearer generated-api-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write a short product description."}'
```

```json
{
  "output": "mocked response",
  "input_tokens": 9,
  "output_tokens": 137
}
```

Query usage:

```bash
curl "http://localhost:4000/usage?api_key=generated-api-key&from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z&group_by=day"
```

```json
{
  "api_key": "generated-api-key",
  "from": "2026-09-01T00:00:00.000Z",
  "to": "2026-09-30T23:59:59.999Z",
  "group_by": "day",
  "totals": {
    "input_tokens": 9,
    "output_tokens": 137,
    "total_tokens": 146,
    "input_cost": 0.000009,
    "output_cost": 0.000274,
    "total_cost": 0.000283
  },
  "breakdown": [
    {
      "key": "2026-09-17",
      "input_tokens": 9,
      "output_tokens": 137,
      "total_tokens": 146,
      "input_cost": 0.000009,
      "output_cost": 0.000274,
      "total_cost": 0.000283
    }
  ]
}
```

## Data Model

`Deployment`

- `deployment_id`: unique public deployment identifier
- `model`: `model-a` or `model-b`
- `status`: `provisioning`, `ready`, or `terminated`
- `api_key`: generated key, exposed only when ready
- `endpoint_url`: generated endpoint, exposed only when ready
- `created_at`, `updated_at`

Indexes:

- unique index on `deployment_id`

`UsageEvent`

- `api_key`
- `deployment_id`
- `model`
- `input_tokens`
- `output_tokens`
- `timestamp`

Indexes:

- `{ deployment_id: 1, timestamp: -1 }`
- `{ api_key: 1, timestamp: -1 }`

The current model is single-tenant by API key. In a production multi-tenant system I would add explicit `tenant_id` or `account_id` fields to both collections and include them in authorization checks and aggregation indexes.

## Testing Instructions

Run:

```bash
npm run typecheck
npm test
```

The integration tests require a reachable MongoDB instance. To use a custom test database:

```bash
TEST_MONGODB_URI=mongodb://localhost:27017/usage-based-api-test npm test
```

## Scaling Metering to 10,000 Requests/Second

For 10,000 requests/second, I would separate request serving from metering persistence.

The API tier would run horizontally behind a load balancer. Each instance would be stateless, with deployment/API-key lookup cached briefly in Redis or a similar shared cache. Rate limiting would move from the current in-memory map to a distributed store such as Redis using atomic counters, sliding-window logs, or token buckets keyed by API key.

Completion requests would emit usage events asynchronously to Kafka, SQS, Pub/Sub, or a similar durable queue. The request path would validate auth, enforce rate limits, return the mocked/model response, and enqueue a compact event containing an idempotency key, API key, deployment ID, model, token counts, timestamp, and request ID.

Metering workers would consume events in parallel, batch writes, and persist them to an append-only event store or analytical database. Batching would reduce write amplification. Idempotency keys would prevent double-counting during retries or queue redelivery.

For aggregation, I would keep raw immutable events for auditability and write rollups into a query-optimized store such as ClickHouse, BigQuery, Redshift, or pre-aggregated MongoDB/Postgres tables. Common queries like usage by day, model, account, and billing period would read from rollups rather than scanning raw events.

Backpressure and failure handling would be explicit. If the queue is unavailable, the API would either fail closed for billable requests or use a bounded local buffer depending on business requirements. Workers would use retries, dead-letter queues, lag monitoring, and alerting. Queue lag and write failures would be treated as billing-critical operational signals.

## Trade-Offs

MongoDB was used because it keeps setup simple for a take-home and works well enough for deployment records plus usage-event aggregation. It is not the only good choice; a relational database would also be reasonable, especially with explicit tenant/account modeling.

In-memory rate limiting was used to keep the service small and easy to run locally. The limitation is that limits are per process, reset on restart, and are not correct across multiple API instances.

Provisioning is simulated with a delayed async transition. This satisfies the lifecycle requirement without introducing a real provisioning system. The limitation is that timers are process-local; a restart during provisioning could leave a deployment stuck unless a background reconciler is added.

Usage persistence is synchronous after completion generation. This keeps correctness easy to understand for the assignment: if a completion succeeds, the usage event is written immediately. At high throughput this would add latency and couple API availability to the database, so production metering should use asynchronous ingestion.

## Assumptions

- Only `model-a` and `model-b` are valid.
- Input tokens are calculated as `Math.round(prompt.length / 4)`.
- Output tokens are randomly generated between 50 and 200.
- Pricing is `$0.001` per 1,000 input tokens and `$0.002` per 1,000 output tokens.
- API keys are associated with exactly one deployment.
- Terminated deployments cannot process completions.
- Usage is recorded only for successful completion requests.

## What I Would Do Differently With More Time

- Add explicit tenant/account modeling instead of relying only on API keys.
- Add a provisioning reconciler so deployments cannot get stuck after process restarts.
- Replace in-memory rate limiting with Redis-backed distributed rate limiting.
- Move usage metering to an asynchronous queue and worker pipeline.
- Add request IDs, structured logging, metrics, and tracing.
- Add more focused unit tests around services in addition to integration tests.
- Add migration/index management instead of relying only on Mongoose model definitions.
