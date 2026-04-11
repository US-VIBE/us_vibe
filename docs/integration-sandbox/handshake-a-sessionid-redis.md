# A(오케스트레이터) 합의 포인트: sessionId · 이벤트 소비

## `INTEGRATION_WEBHOOK_SESSION_ID`

- 미설정 시 서버는 웹훅 `IntegrationEvent.sessionId`를 `github-ingest`로 둔다.
- **시뮬 세션 UUID**로 설정하면 SQLite `integration_events`와 동일 키로 조회할 수 있고, UUID일 때 Postgres `collaboration_events`로도 미러된다 ([event-vocabulary-map.md](event-vocabulary-map.md)).
- A/SSOT가 사용하는 세션 식별자와 맞출지(항상 UUID·별도 매핑 테이블 등)를 합의한다.

## 이벤트 소비 방식

- **현재:** 1차는 SQLite 스트림; `GET /api/integration/events` 폴링 또는 (선택) Redis Pub/Sub.
- **Redis:** `REDIS_URL` + `INTEGRATION_REDIS_PUBLISHER=1`일 때 채널 `INTEGRATION_REDIS_CHANNEL`(기본 `integration:events`)로 JSON 페이로드 발행. A가 구독할 경우 **중복 처리(idempotency)**·재연결 정책을 정한다.
- JWT 폐기용 Redis와 **채널만 분리**해 사용한다 ([redis-usage.md](../backend/redis-usage.md)).
