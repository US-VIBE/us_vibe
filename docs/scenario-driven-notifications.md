# 시나리오 주도 체험 — 인앱 알림·이벤트

## 채널 요약

| 채널 | 저장 위치 | 용도 |
|------|-----------|------|
| Postgres `collaboration_events` | 시뮬 세션 UUID | `POST /sessions` 직후 `scenario_briefing_published`, 구현 완료 등 기존 협업 타임라인 |
| SQLite `in_app_notification` | 워크스페이스 `session_id` | 아티팩트 업로드 등 **JWT 워크스페이스** 전용 짧은 알림 |
| SQLite `integration_events` + (선택) Redis | `INTEGRATION_WEBHOOK_SESSION_ID` | GitHub 웹훅·정적 검증 스트림 |
| SSE `GET /api/integration/stream` | — | Thought Stream / 실시간 한 줄 요약 |

## 확장 시

이메일·Slack 등 **아웃바운드** 알림을 추가할 때는 `SessionNotificationChannel` 같은 인터페이스를 두고, `SqliteInAppChannel`과 병렬로 `EmailChannel`을 등록하면 된다. 현재 구현은 SQLite 인앱 피드와 Postgres 협업 이벤트만 사용한다.

## 관련 코드

- 시나리오 브리핑 발행: [`apps/api/src/sessions/sessions.service.ts`](../apps/api/src/sessions/sessions.service.ts)
- 인앱 알림 기록: [`apps/api/src/persistence/workspace-persistence.service.ts`](../apps/api/src/persistence/workspace-persistence.service.ts) (`appendInAppNotification`)
- 웹 연동 패널: [`apps/web/components/workspace/integration-tools-panel.tsx`](../apps/web/components/workspace/integration-tools-panel.tsx)
