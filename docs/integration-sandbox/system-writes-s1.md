# 웹훅·시스템 경로 쓰기와 세션 소유 (S-1 보완)

GitHub `POST /webhooks/github` 등 **JWT 없이** SQLite·이벤트 스트림에 쓰는 경로는, 워크스페이스 `sessionId`와 **로그인 사용자**의 강결합([fe-web-integration.md](../fe-web-integration.md) §7)보다 넓게 이벤트를 남길 수 있다. 이 문서는 **감사·정책**만 고정한다; 구현 티켓은 [vision-product-backlog.md](../vision-product-backlog.md) S-1.

## 현재 동작 요약

- 웹훅은 `INTEGRATION_WEBHOOK_SESSION_ID`(또는 기본 `github-ingest`)로 `IntegrationEvent.sessionId`를 붙인다.
- `workspace_session`이 해당 UUID로 존재할 때만 일부 병합(예: `ProjectState.codeDeltaSummary`, Postgres 타임라인 미러)이 의미 있다.
- 인증된 워크스페이스 API와 달리, 웹훅은 **GitHub 서명·IP 허용**(S-2)으로 보호된다.

## 운영 권장 (G-3)

1. **로그:** 웹훅 수신·거부(401/403)·검증 큐 적재는 구조화 로그에 `deliveryId`·`event`·`sessionId` 키를 남긴다.
2. **SQLite 감사 테이블 (`webhook_ingest_audit`):** API 기동 시 워크스페이스 DB(`DATABASE_PATH`, 기본 `data/usvibe.db`)에 append-only 행이 쌓인다. GitHub `X-GitHub-Delivery`, `X-GitHub-Event`, 해석된 클라이언트 IP, `INTEGRATION_WEBHOOK_SESSION_ID`와 동일한 `ingest_session_id`, 처리 결과(`outcome`: `processed` \| `ignored_event` \| `rejected_ip` \| `rejected_signature`), 선택 `detail` 문자열. INSERT 실패는 웹훅 HTTP 응답을 바꾸지 않는다. **조회:** 공개 REST 없음 — 백업 파일·SQLite CLI·관측 파이프로 조회한다.
3. **알림:** 프로덕션에서 예기치 않은 `sessionId`(비UUID·타 팀 UUID)로 쌓이면 대시보드 또는 알림 규칙으로 검토한다.
4. **강결합 로드맵:** `owner_user_id`가 있는 워크스페이스 행에만 코드 델타·고위험 쓰기를 제한할지, 별도 “인제스트 전용” 세션을 둘지 팀 합의 후 티켓화한다.

## 관련 문서

- [session-id-sync.md](session-id-sync.md)
- [collaboration-env-and-endpoints.md](../collaboration-env-and-endpoints.md) §3.2
