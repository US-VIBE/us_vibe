# Redis: JWT denylist

## Purpose

When `REDIS_URL` is set, revoked JWT `jti` values are stored with TTL equal to the remaining access-token lifetime so **logout invalidates the current access token** without touching the database.

## Environment

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Example: `redis://127.0.0.1:6379`. When unset, denylist features are disabled (`GET /health/redis` reports `redis: "disabled"`). |

## Local stack

[`docker-compose.yml`](../../docker-compose.yml) includes a `redis` service on port **6379** alongside PostgreSQL.

```bash
docker compose up -d redis postgres
```

## Implementation

- Store: [`RevokedTokenStore`](../../src/backend/src/redis/revoked-token.store.ts) in `@us-vibe/backend` (ioredis).
- Wiring: [`RedisIntegrationModule`](../../apps/api/src/redis/redis.module.ts) (global Nest module).
- Guard: [`JwtAuthGuard`](../../apps/api/src/auth/jwt-auth.guard.ts) rejects tokens present in the denylist.
- Logout: [`POST /auth/logout`](../../specs/openapi/v1.yaml) verifies the bearer token then calls `revoke(jti, ttlSeconds)`.

## Health

`GET /health/redis` returns `{ ok, redis }` where `redis` is `disabled`, `up`, or `down`. `ok` is `true` when Redis is disabled or responds to `PING`.
