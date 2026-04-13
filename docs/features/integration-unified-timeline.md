# 통합 협업 타임라인 (Unified Timeline)

## 목적

SQLite `integration_events`와 Postgres `collaboration_events`(시뮬 세션 UUID일 때)를 **한 응답**으로 받아, PR·검증·시뮬 이벤트를 시간순으로 한 흐름으로 본다.

## API

- **경로:** `GET /api/integration/unified-timeline` (JWT)
- **쿼리**
  - `sessionId` (필수)
  - `limit` (기본 50)
  - `sortOrder`: `asc` | `desc` (병합 목록 정렬)
  - `sources`: `both` | `sqlite` | `postgres` — **응답의 SQLite 배열·Postgres 배열·병합 목록 모두**에 동일 적용
  - `types`: 쉼표 구분 부분 문자열 — 이벤트 `type` / `eventType` 대소문자 무시 부분 일치
- **응답:** `integrationEvents`, `postgresTimeline`(필터 후), `mergedTimeline`, `postgresNote`, `bridgeHint`

## 코드

- 컨트롤러: [`apps/api/src/integration/integration-events.controller.ts`](../../apps/api/src/integration/integration-events.controller.ts)
- 병합·필터 유틸: [`apps/api/src/integration/unified-timeline-merge.util.ts`](../../apps/api/src/integration/unified-timeline-merge.util.ts)
- 웹: [`apps/web/lib/unified-timeline-api.ts`](../../apps/web/lib/unified-timeline-api.ts), 연동 패널 [`integration-tools-panel.tsx`](../../apps/web/components/workspace/integration-tools-panel.tsx)

## 테스트

- 단위: [`apps/api/test/unit/unified-timeline-merge.util.spec.ts`](../../apps/api/test/unit/unified-timeline-merge.util.spec.ts) (`npm run test:unit -w api`)
