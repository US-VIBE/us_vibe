# PR: 연동·워크스페이스 구체화 (integration-next)

## 요약

다음 구체화 플랜(환경 UUID, Redis/SSE 계약, unified-timeline 스키마·UI, sessionId 동기화, ProjectState·DoD 문서/FE, checklist·`[contract-changed]`)을 반영합니다. **기능별 커밋 6개**로 나누어 푸시했습니다.

## 커밋 목록

| 커밋 | 설명 |
|------|------|
| `docs(api): INTEGRATION_WEBHOOK_SESSION_ID…` | `collaboration-env-and-endpoints` §3.1, `event-vocabulary-map`, `apps/api/.env.example` |
| `specs: unified-timeline postgresTimeline…` | `specs/openapi/v1.yaml`, `specs/api-contract.md` |
| `docs: 워크스페이스 sessionId와 시뮬·웹훅…` | `docs/integration-sandbox/session-id-sync.md`, README |
| `docs(web): fe-web-integration에 SSE·타임라인·DoD…` | Redis/SSE 표, 탭 UI 결정, DoD vs `POST /sessions/:id/verify` |
| `feat(web): 통합 타임라인 탭·ProjectState PATCH UI` | `integration-tools-panel`, `unified-timeline-api`, `workspace-collab-api` |
| `docs(process): Gate B/C·[contract-changed]…` | `docs/checklist.md`, `docs/team-role-charter.md` |

## 변경 하이라이트

- **운영·환경**: `INTEGRATION_WEBHOOK_SESSION_ID` 권장 기본값·데모/CI 예외를 한 곳(§3.1)에 고정.
- **계약**: `postgresTimeline` 항목을 OpenAPI `CollaborationEventTimelineItem`로 명시; `api-contract.md` 보강.
- **동기화**: `session-id-sync.md`로 워크스페이스 `sessionId`와 시뮬·웹훅 UUID 정렬 플로우 문서화.
- **FE**: 통합 타임라인 **SQLite / Postgres 탭**, `activeSprintGoal` PATCH 및 `VERSION_CONFLICT` 처리.
- **프로세스**: Gate B 체크, PR 본문·`[contract-changed]` 라벨 규칙.

## 검증

- [x] `node scripts/validate-api-contract.js`
- [x] `npm run lint -w web`

## 리뷰 노트

- OpenAPI·`api-contract.md` 변경 시 **`[contract-changed]`** 라벨 부착 권장 ([`docs/checklist.md`](docs/checklist.md), [`docs/team-role-charter.md`](docs/team-role-charter.md)).

## 베이스 브랜치

`develop` ← `feature/hanseungjun-d-integration-next`
