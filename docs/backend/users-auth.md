# Users and authentication

## Scope

- Email and password registration and login.
- JWT access tokens with `jti` for optional server-side invalidation (see [Redis usage](redis-usage.md)).
- Profile read via `GET /users/me`.

## HTTP

| Method | Path | Notes |
|--------|------|--------|
| POST | `/auth/register` | 201, body `{ email, password }`, returns `{ accessToken, refreshToken }` and sets HttpOnly refresh cookie (`/`). |
| POST | `/auth/login` | 200, same body shape; same tokens and cookie. |
| POST | `/api/auth/register` \| `/api/auth/login` | 웹 계약: `{ ok, data: { accessToken, user } }` + 동일 refresh 쿠키. |
| POST | `/api/auth/refresh` | HttpOnly refresh 쿠키로 액세스 토큰 재발급(리프레시 회전). |
| POST | `/api/auth/logout` \| `/auth/logout` | Bearer 액세스 + refresh 쿠키 폐기; 액세스·리프레시 `jti`를 Redis에 거부(설정 시). |
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
| `REFRESH_COOKIE_SAMESITE` | `lax`(기본) \| `strict` \| `none`(크로스 사이트 API+HTTPS 시). |

## Password rules

- Minimum length 8 characters.
- Email must contain `@` (lightweight validation; stricter formats belong in a later iteration).
