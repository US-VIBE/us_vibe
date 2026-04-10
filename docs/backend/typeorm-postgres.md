# TypeORM and PostgreSQL

## Overview

The API uses [`@nestjs/typeorm`](https://docs.nestjs.com/techniques/database) in [`apps/api`](../../apps/api) with connection options and migrations defined in [`@us-vibe/backend`](../../src/backend). The default connection string matches the local Docker service in [`docker-compose.yml`](../../docker-compose.yml).

## Local database

1. Copy [`.env.example`](../../.env.example) to `.env` at the repo root (or export variables in your shell).
2. Start PostgreSQL (and optional Redis for JWT denylist):

   ```bash
   docker compose up -d postgres redis
   ```

3. Apply migrations (from repo root, workspace `src/backend`):

   ```bash
   npm install
   npm run build -w @us-vibe/backend
   npm run migration:run -w @us-vibe/backend
   ```

The `InitDb` migration is intentionally a no-op `SELECT 1` so the migration table and pipeline exist before domain tables are added.

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Full Postgres URL (user, password, host, port, database). |
| `TYPEORM_LOGGING` | Set to `1` to log SQL from TypeORM. |

## Nest wiring

[`apps/api/src/app.module.ts`](../../apps/api/src/app.module.ts) calls `TypeOrmModule.forRoot(createDataSourceOptions())` where `createDataSourceOptions` is exported from `@us-vibe/backend`.

## Contract

`GET /health/db` is described in [`specs/openapi/v1.yaml`](../../specs/openapi/v1.yaml). It returns `database: "up"` when `SELECT 1` succeeds and `database: "down"` when the driver throws (for example Postgres is stopped).
