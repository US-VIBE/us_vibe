# IntegrationEventType ↔ collaboration_events.eventType

[`specs/data-model/types.ts`](../../specs/data-model/types.ts)의 `IntegrationEventType`(D·SQLite `integration_events`)과  
[`docs/backend/agent-event-log.md`](../backend/agent-event-log.md)의 Postgres `collaboration_events.eventType` 권장 값을 맞춘다.

**웹훅 `sessionId` 운영 규칙(기본값·데모·CI):** [`collaboration-env-and-endpoints.md`](../collaboration-env-and-endpoints.md) §3.1.

## 미러링 조건

- [`IntegrationTimelineBridgeService`](../../apps/api/src/integration/integration-timeline-bridge.service.ts)는 **`IntegrationEvent.sessionId`가 RFC 4122 UUID v4 형식**일 때만 Postgres에 append한다.
- 운영에서 타임라인을 합치려면 `INTEGRATION_WEBHOOK_SESSION_ID`를 **해당 시뮬 세션 UUID**로 설정한다 ([`docs/collaboration-env-and-endpoints.md`](../collaboration-env-and-endpoints.md) §3.1). 절차 예시는 [`session-id-sync.md`](session-id-sync.md).
- `github-ingest` 등 비 UUID이면 SQLite 스트림과 `GET /api/integration/events`만 갱신되고, `GET /sessions/:id/timeline`에는 나타나지 않는다.

## 매핑 표

| `IntegrationEventType` | Postgres `eventType` | 비고 |
|------------------------|----------------------|------|
| `VALIDATION_FAILED` | `contract_violation` | `payload`에 `validationResult`·`integrationType` 등 포함 |
| `VALIDATION_LOOP_DETECTED` | `contract_violation` | `prNumber`, `consecutiveFailures`(연속 실패 streak) |
| `VALIDATION_PASSED` | `review_passed` | 동일 |
| `PR_OPENED`, `PR_UPDATED`, `PR_MERGED` | `supervisor_route` | PR 메타(`prNumber`, `branch`, `author`) |
| `CODE_DELTA_ANALYZED` | `supervisor_route` | `codeDeltaSummary` |
| `VFS_SNAPSHOT_CREATED`, `VFS_APPROVED` | `agent_reply` | VFS 페이로드 |
| `CONTRACT_CHANGED` | `agent_reply` | 계약 diff 등 |

모든 미러 이벤트의 `payload`에는 최소한 다음 봉투 필드가 들어간다.

- `integrationType` — 원본 `IntegrationEvent.type`
- `triggeredBy` — `github` \| `user` \| `agent`
- `stateVersion` — 워크스페이스 이벤트 상관용
- `integrationTimestamp` — ISO 문자열

## 타임라인 병합 대안

현재 구현은 **이중 기록(append)** 이다. 워크스페이스용으로 **`GET /api/integration/unified-timeline?sessionId=&limit=`** 가 SQLite `integration_events`와 Postgres `GET /sessions/:id/timeline` 결과를 한 JSON에 담는다(세션이 Postgres에 없으면 `postgresNote`에 이유). 단일 뷰만 필요하면 FE는 이 엔드포인트를 쓰거나, B와 합의해 `GET /sessions/:id/timeline` 확장을 검토한다.

## 변경 시

새 `IntegrationEventType`을 추가하면 이 표와 `integration-timeline-bridge.service.ts`의 `map` 분기를 함께 갱신하고, A 승인 하에 [`agent-event-log.md`](../backend/agent-event-log.md) 어휘를 확장한다.
