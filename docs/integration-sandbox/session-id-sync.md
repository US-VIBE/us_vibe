# 워크스페이스 학습 sessionId ↔ 시뮬(Postgres) ↔ 웹훅 동기화

한 사용자 흐름에서 **같은 UUID**를 쓰면 SQLite 워크스페이스·Postgres 시뮬·GitHub 웹훅 미러가 한 줄로 맞는다. 이 문서는 **현재 구현 기준 권장 플로우**를 고정한다.

## 식별자 종류

| 식별자 | 저장 위치 | 생성 시점 |
|--------|-----------|-----------|
| **학습 세션 UUID** | 브라우저(온보딩)·워크스페이스 전역 | 기본: 온보딩이 `POST /sessions` 응답 `id`를 씀([`simulation-session-api.ts`](../../apps/web/lib/simulation-session-api.ts)). 오프라인/API 실패 시 임시 UUID. 선택 입력으로 기존 시뮬 UUID를 붙여넣을 수 있음([`onboarding-form.tsx`](../../apps/web/components/onboarding/onboarding-form.tsx)). |
| **시뮬 세션 UUID** | Postgres `simulation_sessions` | `POST /sessions` 응답 `id` |
| **웹훅 `sessionId`** | API가 `IntegrationEvent.sessionId`에 기록 | **현재 구현:** GitHub 본문에서 읽지 않음. 항상 환경 변수 `INTEGRATION_WEBHOOK_SESSION_ID`(미설정 시 `github-ingest`) — [`webhook.controller.ts`](../../apps/api/src/integration/webhook.controller.ts) |

## 권장 플로우 (풀스택 데모)

1. **기본:** 온보딩 제출 시 `NEXT_PUBLIC_API_URL`이 있으면 [`createSimulationSessionForWorkspace`](../../apps/web/lib/simulation-session-api.ts)가 **`POST /sessions`** 를 호출하고, 응답 **`id`를 학습 `sessionId`로 사용**한다.
2. **이미 만든 시뮬 세션과 맞출 때:** 온보딩 **「기존 시뮬 세션 ID」**에 UUID v4를 넣으면 `GET /sessions/:id`로 존재를 확인한 뒤 그 값을 학습 `sessionId`로 쓴다.
3. **API 서버 `.env`**: `INTEGRATION_WEBHOOK_SESSION_ID=<위와 동일 UUID>` ([§3.1 운영 정책](../collaboration-env-and-endpoints.md)).
4. 웹훅을 쏘면 [`IntegrationTimelineBridgeService`](../../apps/api/src/integration/integration-timeline-bridge.service.ts)가 UUID일 때 Postgres `collaboration_events`에도 append한다.

## 아직 없는 자동화 (향후 B/C)

- 서버 `INTEGRATION_WEBHOOK_SESSION_ID`를 온보딩이 **자동으로 읽어 동기화**하는 BFF(현재는 배포 시 수동 설정).
- “시뮬만 쓰기” 모드에서 워크스페이스 없이 `sessionId`를 시뮬 id로만 쓰는 단순 경로.

## FE 주의 (F-1)

- 통합 이벤트 폴링·SSE·`unified-timeline` 쿼리의 `sessionId`는 **워크스페이스에 쓰는 학습 세션 UUID**와 같아야 한다.
- GitHub 연동 이벤트를 같은 탭에서 보려면 **서버 `INTEGRATION_WEBHOOK_SESSION_ID`를 그 UUID로 맞출 것** — 그렇지 않으면 SQLite 스트림만 `github-ingest` 등으로 쌓이고 UI는 빈 목록이 될 수 있다. ([`fe-web-integration.md`](../fe-web-integration.md) §2·§4, [`collaboration-env-and-endpoints.md`](../collaboration-env-and-endpoints.md) §3.1)

## 관련 API

- `GET /api/integration/unified-timeline?sessionId=<UUID>` — SQLite + Postgres 병합 조회
- `GET /sessions/{id}/timeline` — Postgres만
