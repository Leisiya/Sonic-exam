# Sonic SVM Transaction Indexer (TypeScript)

Production-style Sonic SVM indexer + query API with idempotent ingestion, replay safety, and reorg handling.

## Tech Stack

- TypeScript + Node.js 20
- Fastify (API)
- Prisma + Postgres (persistence)
- Vitest (tests)
- GitHub Actions (lint/test/build)
- Railway (deployment target)

## Live Demo / Submission

- GitHub: [https://github.com/Leisiya/Sonic-exam](https://github.com/Leisiya/Sonic-exam)
- Base URL: [https://sonic-exam-production.up.railway.app](https://sonic-exam-production.up.railway.app)
- Health: [https://sonic-exam-production.up.railway.app/health](https://sonic-exam-production.up.railway.app/health)
- Stats: [https://sonic-exam-production.up.railway.app/stats](https://sonic-exam-production.up.railway.app/stats)

## Architecture Overview

Two-process design in one repository:

- API service (`src/server.ts`): serves query and health endpoints.
- Worker service (`src/worker.ts`): continuously ingests mocked SVM events.
- Shared Postgres: stores transactions, aggregates, account activity, and ingestion state.

```text
Mock Stream -> Worker -> Postgres <- API
```

## Data Model

Core tables:

- `Transaction`: canonical transaction record by `signature`.
- `TransactionProgram`: tx-program relation.
- `TransactionAccount`: tx-account relation.
- `ProgramSlotUsage`: per-program-per-slot aggregates.
- `AccountActivity`: per-account transaction activity.
- `IngestionCheckpoint`: worker cursor (`lastEventId`, `lastProcessedSlot`).
- `ProcessedEvent`: idempotency table by `eventId`.

Key indexes:

- `Transaction(slot)`, `Transaction(blockTime)`
- `TransactionProgram(programId)`
- `TransactionAccount(address)`
- `AccountActivity(address, slot DESC)`

## Idempotency, Replay, Reorg Strategy

### Idempotency

- Every event has `eventId`; worker inserts into `ProcessedEvent` in the same DB transaction.
- Duplicate `eventId` is skipped.
- Duplicate transaction `signature` is rejected by unique key and does not alter aggregates.

### Replay Safety

- Worker keeps `IngestionCheckpoint` per `workerId`.
- On restart, ingestion resumes from `lastEventId`.
- Replaying already processed events does not change state.

### Reorg Handling

- Reorg event: `type = "reorg"` with `rollbackToSlot`.
- Worker deletes data with `slot > rollbackToSlot` from canonical and aggregate tables.
- Subsequent tx events re-populate deterministic state.

## API Endpoints

- `GET /health`
- `GET /stats`
- `GET /tx/:signature`
- `GET /programs/:programId/usage?fromSlot=&toSlot=`
- `GET /accounts/:address/activity?limit=`

## Endpoint Details

### `GET /health`

Purpose:

- Service liveness/readiness check.
- Verifies API process and database connectivity.

Response fields:

- `status`: service status (`ok` when healthy).
- `db`: database status (`up` when query succeeds).
- `time`: server timestamp (ISO string).

### `GET /stats`

Purpose:

- Returns ingestion and indexing summary for quick system validation.

Response fields:

- `indexedTx`: total indexed transactions.
- `uniquePrograms`: distinct program IDs seen (string for bigint safety).
- `uniqueAccounts`: distinct account addresses seen (string for bigint safety).
- `lastProcessedEventId`: latest processed stream event.
- `lastProcessedSlot`: latest processed slot checkpoint.
- `uptimeSec`: API process uptime in seconds.

### `GET /tx/:signature`

Purpose:

- Fetches canonical indexed transaction details by signature.

Path params:

- `signature`: transaction signature.

Response fields:

- `signature`, `slot`, `blockTime`, `feeLamports`, `computeUnits`, `error`
- `instructions[]`: persisted transaction instructions.
- `programIds[]`: related programs.
- `accounts[]`: related accounts.

Notes:

- `feeLamports` and `totalFeeLamports` are returned as strings to avoid precision loss on large values.

Error:

- `404` with `{ code: "TX_NOT_FOUND", message: "Transaction not found" }` when signature is missing.

### `GET /programs/:programId/usage?fromSlot=&toSlot=`

Purpose:

- Aggregated per-program usage over a slot range.

Path params:

- `programId`: target program.

Query params:

- `fromSlot` (optional, integer, inclusive lower bound)
- `toSlot` (optional, integer, inclusive upper bound)

Validation:

- `fromSlot > toSlot` returns `400`.

Response fields:

- `programId`, `fromSlot`, `toSlot`
- `txCount`
- `totalFeeLamports`
- `totalComputeUnits`

### `GET /accounts/:address/activity?limit=`

Purpose:

- Recent activity feed for an account address, sorted by latest slot first.

Path params:

- `address`: account address.

Query params:

- `limit` (optional, default `20`, max `100`)

Validation:

- `limit > 100` returns `400`.

Response fields:

- `address`
- `limit`
- `activity[]` entries containing `address`, `signature`, `slot`, `blockTime`.

### Example Responses

`GET /health`

```json
{
  "status": "ok",
  "db": "up",
  "time": "2026-03-01T10:00:00.000Z"
}
```

`GET /stats`

```json
{
  "indexedTx": 3,
  "uniquePrograms": "2",
  "uniqueAccounts": "4",
  "lastProcessedEventId": 7,
  "lastProcessedSlot": 103,
  "uptimeSec": 42
}
```

## Local Development

1. Copy env file:

```bash
cp .env.example .env
```

2. Ensure a Postgres instance is available and `.env` points `DATABASE_URL` to it.

3. Install dependencies:

```bash
npm ci
```

4. Generate Prisma client + migrate:

```bash
npm run prisma:generate
npm run migrate:deploy
```

5. Run API and worker in separate terminals:

```bash
npm run dev:api
npm run dev:worker
```

6. Run tests (integration tests require `DATABASE_URL` and fail fast when missing):

```bash
npm run test
```

## Quality Gates

```bash
npm run lint
npm run test
npm run build
```

## GitHub Actions CI

Workflow file: `.github/workflows/ci.yml`

Pipeline steps:

- install dependencies
- prisma generate
- migrate deploy
- lint
- test
- build

## Railway Deployment

Create three Railway services in the same project:

1. `postgres` plugin
2. `api` service from this repo
3. `worker` service from this repo

Set env vars for both app services:

- `DATABASE_URL` (from Railway Postgres)
- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `WORKER_ID` (set explicitly and keep it unique per worker replica, e.g. `worker-1`, `worker-2`)
- `PORT` (API only)

Commands:

- API start command:

```bash
npm run migrate:deploy && npm run start
```

- Worker start command:

```bash
npm run migrate:deploy && npm run start:worker
```

Submission checklist:

- GitHub repo link
- Railway public base URL
- `/health` URL
- `/stats` URL

## Scaling Strategy (10x Load)

- Split API/worker horizontally.
- Partition event stream by slot range or program shard.
- Move heavy aggregates to async pipeline/materialized views.
- Add Redis cache for hot `program usage` and `account activity` queries.
- Add read replicas for query traffic.

## Tradeoffs

- Chose Fastify over heavier frameworks for faster delivery and strong performance.
- Chose Prisma for schema/type speed and migration consistency.
- Chose rollback+rebuild-on-new-events reorg model for deterministic correctness with low complexity.
