# Integration & Sandbox (역할 D) 문서

이 디렉터리는 팀 역할 **D · 인테그레이션 & 샌드박스** 담당 문서만 모아 둔다.

**팀 공통 진입점(환경 변수·엔드포인트 표):** [`docs/collaboration-env-and-endpoints.md`](../collaboration-env-and-endpoints.md)  
**시뮬 세션·인증·Postgres 상세:** [`docs/api/collaboration-endpoints-and-env.md`](../api/collaboration-endpoints-and-env.md)

전체 팀 규칙은 [`../team-role-charter.md`](../team-role-charter.md)를 참고한다.

## 문서 목록

| 문서 | 설명 |
|------|------|
| [`collaboration-interface.md`](collaboration-interface.md) | A/B/C와 맞출 이벤트·엔드포인트·환경변수·공유 타입 |
| [`event-vocabulary-map.md`](event-vocabulary-map.md) | `IntegrationEventType` ↔ Postgres `collaboration_events.eventType` 매핑 |
| [`session-id-sync.md`](session-id-sync.md) | 학습 sessionId · 시뮬 UUID · `INTEGRATION_WEBHOOK_SESSION_ID` 맞추기 |
| [`pr-merge-checklist-for-d.md`](pr-merge-checklist-for-d.md) | develop PR 머지·게이트·라벨 실무 체크 |
| [`handshake-b-openapi-review.md`](handshake-b-openapi-review.md) | B에게 요청할 OpenAPI·types 검토 포인트 |
| [`handshake-a-sessionid-redis.md`](handshake-a-sessionid-redis.md) | A와 맞출 sessionId·Redis Pub/Sub 합의 |
| [`d-integration-pipeline.md`](d-integration-pipeline.md) | Webhook → 검증 → VFS → 이벤트 파이프라인 설계 |
| [`d-integration-scenarios.md`](d-integration-scenarios.md) | PR 검증, 계약 변경, VFS, 실패 처리 시나리오 |
| [`d-integration-dev-notes.md`](d-integration-dev-notes.md) | 날짜별 구현·결정 로그 (개발자 노트) |

## 관련 코드·스크립트 (레포 기준)

- `apps/api/src/integration/` — NestJS 통합 모듈
- `scripts/validate-api-contract.js`, `code-delta-analyzer.js`, `detect-contract-changes.js`
- `.github/workflows/ci.yml`
