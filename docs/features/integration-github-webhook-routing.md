# GitHub 웹훅 저장소 → 세션 라우팅 (멀티유저 격리)

## 목적

동일 API에서 여러 사용자가 웹훅을 쓸 때, GitHub 페이로드의 `repository.full_name`으로 **SQLite 워크스페이스 `sessionId`**를 분기한다. 미등록 시 `INTEGRATION_WEBHOOK_SESSION_ID` 폴백.

## API (JWT)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/integration/webhook-routes` | 내 등록 목록 |
| `POST` | `/api/integration/webhook-routes` | `{ repoFullName, sessionId }` 등록·갱신 |
| `DELETE` | `/api/integration/webhook-routes?repoFullName=owner%2Frepo` | 본인 소유 행만 삭제 |

- `repoFullName`은 서버에서 소문자·trim 정규화.
- 등록 시 해당 `sessionId`에 대해 워크스페이스 접근 권한 검사.
- 컨트롤러에 분당 30회 Throttle 적용.

## 웹훅 감사

`webhook_ingest_audit.detail`에 세션 결정 힌트가 들어간다.

- `session_resolve:repo_route:owner/repo`
- `session_resolve:env_fallback_no_repo_in_payload`
- `session_resolve:env_fallback_unregistered_repo:owner/repo`

## 코드

- 라우트 API: [`integration-webhook-routes.controller.ts`](../../apps/api/src/integration/integration-webhook-routes.controller.ts)
- SQLite: [`workspace-persistence.service.ts`](../../apps/api/src/persistence/workspace-persistence.service.ts) (`github_repo_webhook_route`)
- 웹훅: [`webhook.controller.ts`](../../apps/api/src/integration/webhook.controller.ts)
- PR 검증 큐 잡에 `sessionId` 포함: [`webhook-pr-validation.service.ts`](../../apps/api/src/integration/webhook-pr-validation.service.ts)
- 웹: [`workspace-collab-api.ts`](../../apps/web/lib/workspace-collab-api.ts), [`integration-tools-panel.tsx`](../../apps/web/components/workspace/integration-tools-panel.tsx)
