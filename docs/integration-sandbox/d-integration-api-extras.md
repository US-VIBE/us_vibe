# 통합 API 보강 (웹훅 라우트 · 통합 타임라인 · Redis 재발행)

워크스페이스·연동 화면과 운영 런북에서 쓰는 **추가 REST·환경** 정리. 정본 OpenAPI는 [`specs/openapi/v1.yaml`](../../specs/openapi/v1.yaml)을 따르되, 아직 스펙에 없을 수 있는 엔드포인트는 이 문서를 우선 참고한다.

---

## 1. GitHub 저장소 → 세션 라우팅 (JWT)

**목적:** 동일 API 인스턴스에 여러 사용자가 웹훅을 쓸 때, GitHub 페이로드의 `repository.full_name`으로 SQLite 워크스페이스 `sessionId`를 분기한다. 미등록 시에는 기존처럼 `INTEGRATION_WEBHOOK_SESSION_ID`(환경변수) 폴백.

| 메서드 | 경로 | 본문/쿼리 | 설명 |
|--------|------|-----------|------|
| `GET` | `/api/integration/webhook-routes` | — | 현재 사용자(`JWT sub`)가 등록한 라우트 목록 |
| `POST` | `/api/integration/webhook-routes` | `{ "repoFullName": "owner/repo", "sessionId": "…" }` | `repoFullName`은 소문자·trim 정규화 저장. 해당 `sessionId`에 대해 `assertWorkspaceSessionAccess` 통과 필요 |
| `DELETE` | `/api/integration/webhook-routes?repoFullName=owner%2Frepo` | 쿼리 필수 | 본인 소유 행만 삭제. 없으면 `deleted: false` |

- 구현: [`integration-webhook-routes.controller.ts`](../../apps/api/src/integration/integration-webhook-routes.controller.ts), SQLite [`github_repo_webhook_route`](../../apps/api/src/persistence/workspace-persistence.service.ts).
- 웹훅 수신 시 세션 결정: [`webhook.controller.ts`](../../apps/api/src/integration/webhook.controller.ts)의 `resolveIngestSessionFromPayload`.
- 감사 로그 `webhook_ingest_audit.detail`에 `session_resolve:repo_route:…` / `session_resolve:env_fallback_…` 힌트가 들어가 멀티테넌시 분석에 쓴다.

---

## 2. 통합 타임라인 `GET /api/integration/unified-timeline`

| 쿼리 | 값 | 설명 |
|------|-----|------|
| `sessionId` | 필수 | 워크스페이스 세션 ID |
| `limit` | 숫자, 기본 50 | SQLite `integration_events` 조회 상한 |
| `sortOrder` | `asc` / `desc` | 병합 목록 정렬 (기본 `desc`) |
| `sources` | `both` / `sqlite` / `postgres` | 응답의 SQLite 배열·Postgres 배열·병합 목록 모두에 동일 적용 |
| `types` | 쉼표 구분 부분 문자열 | 이벤트 `type` / `eventType` 대소문자 무시 부분 일치 |

응답:

- `integrationEvents`, `postgresTimeline`: **필터·소스 적용 후** 배열 (SQLite/PG 탭과 병합 탭 일치).
- `mergedTimeline`: 서버 병합 행 (`source`, `title`, `isoTime` 등).

구현: [`integration-events.controller.ts`](../../apps/api/src/integration/integration-events.controller.ts), [`unified-timeline-merge.util.ts`](../../apps/api/src/integration/unified-timeline-merge.util.ts).

---

## 3. Redis Pub/Sub 실패 → BullMQ `integration-redis-replay`

| 변수 | 의미 |
|------|------|
| `INTEGRATION_REDIS_REPLAY_QUEUE` | `1`/`true`일 때만 큐·워커·API 측 적재 활성 |
| `INTEGRATION_BULLMQ` | `1` + `REDIS_URL` 필수 |
| `BULLMQ_PROCESS_ROLE=worker` | `npm run start:bullmq-worker` 시 `integration-pr-validate`와 **함께** 이 큐 Worker 기동 |

동작:

1. 이벤트는 먼저 SQLite에 기록된다 ([`event-publisher.sqlite.ts`](../../apps/api/src/integration/event-publisher.sqlite.ts)).
2. `INTEGRATION_REDIS_PUBLISHER=1`이면 동기 `publish` 재시도 후 성공/실패.
3. 실패(`false`)이고 `INTEGRATION_REDIS_REPLAY_QUEUE=1`이면 큐에 `{ channel, payload }` 적재 ([`integration-redis-replay-queue.service.ts`](../../apps/api/src/integration/integration-redis-replay-queue.service.ts)).
4. 워커가 지연 후 `PUBLISH` 재시도 — **구독자 입장에서는 at-least-once에 가깝다**(직접 publish 성공 후 큐 잡이 중복 실행되면 동일 메시지가 두 번 보일 수 있음). SSE·소비 측에서 필요 시 **이벤트 고유 키**(예: `sessionId`+`timestamp`+`type`+`stateVersion`)로 멱등 처리하는 것을 권장한다.

관측: `GET /api/validation/queue-status` 응답에 `redisReplayQueue` 객체(`queueName`, `enqueueEnabled`, `metrics`)가 포함된다.

---

## 4. 관련 문서

- 환경 변수 표: [`docs/collaboration-env-and-endpoints.md`](../collaboration-env-and-endpoints.md) §`apps/api` 표.
- 웹훅 IP·서명: 동 문서 §3.2.
