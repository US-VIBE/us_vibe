# 워크스페이스 학습 sessionId ↔ 시뮬(Postgres) ↔ 웹훅 동기화

한 사용자 흐름에서 **같은 UUID**를 쓰면 SQLite 워크스페이스·Postgres 시뮬·GitHub 웹훅 미러가 한 줄로 맞는다. 이 문서는 **현재 구현 기준 권장 플로우**를 고정한다.

## 식별자 종류

| 식별자 | 저장 위치 | 생성 시점 |
|--------|-----------|-----------|
| **학습 세션 UUID** | 브라우저(온보딩)·워크스페이스 전역 | 온보딩에서 `crypto.randomUUID()` 등으로 생성 ([`LearningSession`](../../apps/web/lib/session-types.ts)) |
| **시뮬 세션 UUID** | Postgres `simulation_sessions` | `POST /sessions` 응답 `id` |
| **웹훅 `sessionId`** | API가 `IntegrationEvent.sessionId`에 기록 | **현재 구현:** GitHub 본문에서 읽지 않음. 항상 환경 변수 `INTEGRATION_WEBHOOK_SESSION_ID`(미설정 시 `github-ingest`) — [`webhook.controller.ts`](../../apps/api/src/integration/webhook.controller.ts) |

## 권장 플로우 (풀스택 데모)

1. **`/simulate` 또는 API로 시뮬 세션 생성** → 응답 `id`(UUID)를 메모한다.
2. **워크스페이스 온보딩에서 동일 UUID를 학습 `sessionId`로 사용**하도록 온보딩 입력을 맞춘다(현재는 클라이언트 생성 UUID를 수동으로 바꾸거나, 향후 “시뮬 세션에서 이어하기” UI로 연결).
3. **API 서버 `.env`**: `INTEGRATION_WEBHOOK_SESSION_ID=<위 UUID>` ([§3.1 운영 정책](../collaboration-env-and-endpoints.md)).
4. 웹훅을 쏘면 [`IntegrationTimelineBridgeService`](../../apps/api/src/integration/integration-timeline-bridge.service.ts)가 UUID일 때 Postgres `collaboration_events`에도 append한다.

## 아직 없는 자동화 (향후 B/C)

- 온보딩 완료 시 **`POST /sessions`를 호출해 반환 `id`를 학습 세션에 주입**하는 API/BFF.
- “시뮬만 쓰기” 모드에서 워크스페이스 없이 `sessionId`를 시뮬 id로만 쓰는 단순 경로.

## FE 주의 (F-1)

- 통합 이벤트 폴링·SSE·`unified-timeline` 쿼리의 `sessionId`는 **워크스페이스에 쓰는 학습 세션 UUID**와 같아야 한다.
- GitHub 연동 이벤트를 같은 탭에서 보려면 **서버 `INTEGRATION_WEBHOOK_SESSION_ID`를 그 UUID로 맞출 것** — 그렇지 않으면 SQLite 스트림만 `github-ingest` 등으로 쌓이고 UI는 빈 목록이 될 수 있다. ([`fe-web-integration.md`](../fe-web-integration.md) §2·§4, [`collaboration-env-and-endpoints.md`](../collaboration-env-and-endpoints.md) §3.1)

## 관련 API

- `GET /api/integration/unified-timeline?sessionId=<UUID>` — SQLite + Postgres 병합 조회
- `GET /sessions/{id}/timeline` — Postgres만
