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
- `POST /webhooks/github`
- `GET /api/integration/events` (Bearer JWT)
- `GET /api/integration/unified-timeline` (Bearer JWT; query `sessionId`, `limit`)
- `GET /api/integration/stream` (Bearer JWT; SSE `text/event-stream`, 브라우저는 fetch+Authorization 권장)
- `GET /api/validation/status/{prNumber}` (Bearer JWT)
- `POST /api/vfs/snapshot` (Bearer JWT)
- `GET /api/vfs/diff/{snapshotId}` (Bearer JWT)
- `POST /api/vfs/approve/{snapshotId}` (Bearer JWT)
- `GET /api/sessions/{sessionId}/role-gap` (Bearer JWT)
- `PATCH /api/sessions/{sessionId}/session-profile` (Bearer JWT; body `{ humanRoleIds: string[] }`)
- `GET /api/sessions/{sessionId}/workspace-gates` (Bearer JWT)
- `GET /api/sessions/{sessionId}/project-state` (Bearer JWT)
- `PATCH /api/sessions/{sessionId}/project-state` (Bearer JWT; optimistic `expectedVersion`)
- `POST /api/sessions/{sessionId}/workspace-dod-verify` (Bearer JWT)
- `POST /api/sessions/{sessionId}/prompt-spec/convert` (Bearer JWT)
- `POST /api/sessions/{sessionId}/prompt-spec/approve` (Bearer JWT)
- `POST /api/sessions/{sessionId}/contract/validate` (Bearer JWT)
- `POST /api/sessions/{sessionId}/contract/approve` (Bearer JWT)
- `GET /api/sessions/{sessionId}/pr-review` (Bearer JWT)
- `POST /api/sessions/{sessionId}/pr-review/submit` (Bearer JWT)
- `PATCH /api/sessions/{sessionId}/pr-review/comments/{commentId}` (Bearer JWT)
- `POST /api/sessions/{sessionId}/pr-review/re-review` (Bearer JWT)
- `POST /api/sessions/{sessionId}/pr-review/final-approve` (Bearer JWT)
- `GET /api/sessions/{sessionId}/retro/reports` (Bearer JWT)
- `POST /api/sessions/{sessionId}/retro/generate` (Bearer JWT)

회고 리포트 항목(`data.reports[]`, `data.report`): `id`, `sessionId`, `createdAt`, `kpis` 4필드, `nextActions` 3개 문자열, 선택 **`kpiBasis`**(통합 이벤트 기반 규칙 KPI 한 줄 근거, F-6).

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
- success: `{ received: boolean }` for POST /webhooks/github (200)
- success: `{ ok: true, data: { events } }` for GET /api/integration/events (IntegrationEvent[], newest first)
- success: `{ ok: true, data: PrValidationStatusEnvelope | null }` for GET /api/validation/status/{prNumber} — `data`가 null이면 path의 PR 번호가 숫자가 아님. 본문은 `{ prNumber, consecutiveFailures, validation: { prNumber, result, checkedAt } | null }` (`validation` null = SQLite 캐시 행 없음, streak만 의미 있을 수 있음)
- success: `{ ok: true, data: { sessionId, integrationEvents, postgresTimeline, postgresNote, bridgeHint } }` for GET /api/integration/unified-timeline — `integrationEvents`: newest-first `IntegrationEvent[]`; `postgresTimeline`: `CollaborationEventTimelineItem[]` (`id`, `eventType`, `payload`, `sessionId`, `createdAt`), `createdAt` ascending (same order as GET `/sessions/{id}/timeline`)
- success: SSE for GET /api/integration/stream (Redis 구독 시 통합 이벤트 JSON 문자열, 없으면 heartbeat)
- success: `{ ok: true, data: { snapshotId, diffUrl } }` (201) for POST /api/vfs/snapshot; `{ ok: true, data: VfsDiff }` for GET /api/vfs/diff; `{ ok: true, data: VfsSnapshot }` for POST /api/vfs/approve
- error: `{ code: string, message: string }`

## Auth error codes (non-exhaustive)
- `EMAIL_TAKEN`, `AUTH_INVALID_CREDENTIALS`, `AUTH_MISSING_TOKEN`, `AUTH_INVALID_TOKEN`, `TOKEN_REVOKED`, `USER_NOT_FOUND`
- `VALIDATION_EMAIL`, `VALIDATION_PASSWORD`, `VALIDATION_EVENT_TYPE`
- `IMPLEMENTATION_NOT_ACKNOWLEDGED`, `ACK_WRONG_GATE`, `FINISH_WRONG_GATE`
- `PROMPT_SPEC_NOT_APPROVED`, `CONTRACT_INVALID`, `VERSION_CONFLICT` (워크스페이스 project-state·PR 스냅샷)
