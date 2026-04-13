# 통합 SSE 세션 격리

## 목적

공유 API 인스턴스에서 한 사용자의 Redis 통합 이벤트가 다른 사용자의 브라우저 스트림으로 노출되지 않도록 한다.

## 동작 요약

- `GET /api/integration/stream?sessionId=<uuid>` **필수**.
- 연결 시 JWT `sub`에 대해 `WorkspacePersistenceService.assertWorkspaceSessionAccess(sessionId, sub)` 호출.
- Redis Pub/Sub은 기존과 같이 단일 채널을 쓰되, SSE 구독 시 **메시지 JSON의 `sessionId`**가 쿼리와 일치할 때만 `data:`로 전송한다.

## 코드 위치

| 영역 | 경로 |
|------|------|
| API | `apps/api/src/integration/integration-stream.controller.ts` |
| 모듈 순서 | `apps/api/src/app.module.ts` (`PersistenceModule`을 `IntegrationModule` 앞에 두어 DI 안정화) |
| 웹 | `apps/web/lib/integration-sse.ts`, `apps/web/components/workspace/integration-tools-panel.tsx` |

## 참고

프론트는 401 시 `POST /api/auth/refresh`(HttpOnly 쿠키)로 세션 갱신 후 스트림을 한 번 재시도한다.
