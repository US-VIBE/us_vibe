# Users and authentication

## Scope

- Email and password registration and login.
- JWT access tokens with `jti` for optional server-side invalidation (see [Redis usage](redis-usage.md)).
- Profile read via `GET /users/me`.

## HTTP

| Method | Path | Notes |
|--------|------|--------|
| POST | `/auth/register` | 201, body `{ email, password }`, returns `{ accessToken }`. |
| POST | `/auth/login` | 200, same body shape, returns `{ accessToken }`. |
| POST | `/auth/logout` | `Authorization: Bearer <accessToken>`, returns `{ ok: true }`; revokes `jti` in Redis when `REDIS_URL` is set (see [redis-usage](redis-usage.md)). |
| GET | `/users/me` | `Authorization: Bearer <accessToken>`, returns `{ id, email, createdAt }`. |

OpenAPI: [`specs/openapi/v1.yaml`](../../specs/openapi/v1.yaml).

## Implementation map

- Entity and password hashing: [`@us-vibe/backend`](../../src/backend) (`User`, `UsersDataService`).
- HTTP, JWT, guards: [`apps/api/src/auth`](../../apps/api/src/auth).
- Global error shape `{ code, message }`: [`ContractHttpExceptionFilter`](../../apps/api/src/http-exception.filter.ts).

## Environment

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Symmetric secret for signing JWTs. Defaults to an insecure dev value if unset. |

## Password rules

- Minimum length 8 characters.
- Email must contain `@` (lightweight validation; stricter formats belong in a later iteration).
