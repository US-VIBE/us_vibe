# API Contract Summary

## Version
- current: v1

## Endpoints
- `GET /health`
- `GET /health/db`
- `GET /health/redis`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout` (Bearer JWT)
- `GET /users/me` (Bearer JWT)
- `POST /collaboration/events`
- `POST /sessions`
- `GET /sessions/{id}`
- `PATCH /sessions/{id}`
- `POST /sessions/{id}/verify`
- `GET /sessions/{id}/timeline`
- `POST /sessions/{id}/run-scenario`
- `POST /sessions/{id}/implementation-ready`
- `POST /sessions/{id}/run-scenario/finish`

## Response Policy
- success: `{ ok: boolean, service: string }` for `/health`
- success: `{ ok: boolean, database: "up" | "down" }` for `/health/db`
- success: `{ ok: boolean, redis: "disabled" | "up" | "down" }` for `/health/redis`
- success: `{ accessToken: string }` for `/auth/register` (201) and `/auth/login` (200)
- success: `{ ok: true }` for `/auth/logout`
- success: `{ id, email, createdAt }` for `/users/me` (ISO 8601 `createdAt`)
- success: `{ id, createdAt }` for `/collaboration/events` (201)
- success: simulation session object for `/sessions` (201), `/sessions/{id}` (200 GET/PATCH/verify), `/sessions/{id}/implementation-ready` (200), array of timeline events for `/sessions/{id}/timeline` (200)
- success: `{ session, steps, pausedForImplementation?: boolean }` for `/sessions/{id}/run-scenario` (200): default intro stops at gate **B** with `pausedForImplementation: true`; body `{ "skipImplementationWait": true }` runs verify+finish in one call (demo)
- success: `{ session, steps }` for `/sessions/{id}/run-scenario/finish` (200) after gate **C** (Senior + retro to **DONE**)
- error: `{ code: string, message: string }`

## Auth error codes (non-exhaustive)
- `EMAIL_TAKEN`, `AUTH_INVALID_CREDENTIALS`, `AUTH_MISSING_TOKEN`, `AUTH_INVALID_TOKEN`, `TOKEN_REVOKED`, `USER_NOT_FOUND`
- `VALIDATION_EMAIL`, `VALIDATION_PASSWORD`, `VALIDATION_EVENT_TYPE`
- `IMPLEMENTATION_NOT_ACKNOWLEDGED`, `ACK_WRONG_GATE`, `FINISH_WRONG_GATE`
