# 협업 인터페이스 정의 (D. 인테그레이션 & 샌드박스)

> **문서 패키지**: [`docs/integration-sandbox/`](./README.md) — 역할 **D(인테그레이션 & 샌드박스)** 담당 문서 모음입니다.
>
> **팀 공통 진입점**: [`docs/collaboration-env-and-endpoints.md`](../collaboration-env-and-endpoints.md) (URL·환경 변수·엔드포인트 표), [`docs/api/collaboration-endpoints-and-env.md`](../api/collaboration-endpoints-and-env.md) (시뮬 세션·인증 상세).
>
> 이 문서는 D 역할이 A(오케스트레이터), B(백엔드), C(프론트엔드)와 협업할 때 맞춰야 하는 **통합 이벤트 타입**, **HTTP 표면**, **저장소 구분**을 정의합니다.
>
> **변경 규칙**: [`docs/team-role-charter.md`](../team-role-charter.md)의 Cross-Team Handshake Rules 절차를 따릅니다.

---

## 0. 이벤트 저장소 구분 (구현 기준)

| 저장소 | 용도 | 조회 |
|--------|------|------|
| **SQLite** (`DATABASE_PATH`, 워크스페이스 DB) | `integration_events` — D의 `IntegrationEvent` 스트림, PR 검증 캐시 | `GET /api/integration/events`, `GET /api/validation/status/:prNumber` |
| **PostgreSQL** | `collaboration_events` — 에이전트/시뮬 타임라인 (`POST /collaboration/events`) | `GET /sessions/:id/timeline` |

- 런타임 기본: [`EventPublisherSqlite`](../../apps/api/src/integration/event-publisher.sqlite.ts)가 통합 이벤트를 SQLite에 기록한다.
- **Redis `REDIS_URL`**: JWT 폐기(denylist)용이다 ([`docs/backend/redis-usage.md`](../backend/redis-usage.md)). D용 Pub/Sub는 **별도 합의 후** 도입한다.
- 시뮬 세션 UUID와 웹훅을 묶으면, 선택적으로 Postgres에도 미러링한다 ([`event-vocabulary-map.md`](event-vocabulary-map.md), [`integration-timeline-bridge.service.ts`](../../apps/api/src/integration/integration-timeline-bridge.service.ts) 구현 참고).

---

## 1. 이벤트 타입 표준 (`IntegrationEventType`)

[`specs/data-model/types.ts`](../../specs/data-model/types.ts)와 동일한 문자열을 사용한다.

```typescript
type IntegrationEventType =
  | 'PR_OPENED' | 'PR_UPDATED' | 'PR_MERGED'
  | 'VALIDATION_PASSED' | 'VALIDATION_FAILED'
  | 'CODE_DELTA_ANALYZED' | 'CONTRACT_CHANGED'
  | 'VFS_SNAPSHOT_CREATED' | 'VFS_APPROVED'
```

Postgres `collaboration_events.eventType` 권장 값과의 **매핑**은 [`event-vocabulary-map.md`](event-vocabulary-map.md)를 본다.

---

## 2. 이벤트 공통 페이로드 스키마

`IntegrationEvent` 구조는 [`specs/data-model/types.ts`](../../specs/data-model/types.ts)에 정의되어 있다.

- **`sessionId`**: 워크스페이스·웹훅 기본값은 환경 변수 `INTEGRATION_WEBHOOK_SESSION_ID` 또는 `github-ingest`. 시뮬레이터와 타임라인을 맞추려면 **실제 시뮬 세션 UUID**로 설정한다 ([`docs/collaboration-env-and-endpoints.md`](../collaboration-env-and-endpoints.md) §3).
- **`stateVersion`**: 발행 시 `0`이면 SQLite 삽입 시 해당 `session_id` 기준 **MAX+1 자동 부여** ([`WorkspacePersistenceService.appendIntegrationEvent`](../../apps/api/src/persistence/workspace-persistence.service.ts)).

---

## 3. D 소유 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/webhooks/github` | GitHub Webhook (HMAC-SHA256) | `X-Hub-Signature-256` (본문 raw) |
| `GET` | `/api/integration/events` | 통합 이벤트 스트림 (폴링) | Bearer JWT |
| `GET` | `/api/validation/status/:prNumber` | PR별 최신 정적 검증 결과 | Bearer JWT |
| `POST` | `/api/vfs/snapshot` | VFS 스냅샷 생성 | Bearer JWT |
| `GET` | `/api/vfs/diff/:snapshotId` | Diff 조회 | Bearer JWT |
| `POST` | `/api/vfs/approve/:snapshotId` | 스냅샷 승인 | Bearer JWT |

성공/실패 래퍼는 워크스페이스 API 관례에 맞춘다 (`{ ok: true, data }` / `{ ok: false, code, message }`).

---

## 4. 환경변수 (D 관련)

상세 표는 [`docs/collaboration-env-and-endpoints.md`](../collaboration-env-and-endpoints.md) §3. 요약:

```dotenv
# D (연동·VFS·웹훅)
GITHUB_WEBHOOK_SECRET=
GITHUB_TOKEN=
GITHUB_REPO_OWNER=
GITHUB_REPO_NAME=
VFS_STORAGE_PATH=./vfs-store
INTEGRATION_WEBHOOK_SESSION_ID=   # 시뮬 세션 UUID 권장 (타임라인·미러링 일치)

# API (공통)
API_PORT=4000
# API_BASE_URL=http://localhost:4000   # 클라이언트·문서 기본

# 워크스페이스 SQLite (Nest)
DATABASE_PATH=./data/usvibe.db

# PostgreSQL·Redis — B 문서 참고 (Redis는 JWT 폐기용)
# DATABASE_URL=  JWT_SECRET=  REDIS_URL=
```

---

## 5. 팀원별 협업 인터페이스

### 5-A. A(오케스트레이터, 김성원)와 인터페이스

| 항목 | 규칙 |
|------|------|
| 1차 이벤트 소스 | SQLite `integration_events` — `GET /api/integration/events?sessionId=&limit=` 폴링 또는 후속 Redis Pub/Sub (합의 시) |
| 이벤트 발행 시점 | 정적 검증 완료, VFS 스냅샷/승인, GitHub PR 훅 처리 시 (구현: `EventPublisherSqlite`) |
| Postgres 미러 | `INTEGRATION_WEBHOOK_SESSION_ID`가 **UUID**일 때만 `collaboration_events`에 권장 타입으로 append (선택, B 리뷰) |
| Gate 연계 | `VALIDATION_PASSED` 등은 시뮬 게이트와 별개일 수 있음 — 제품 규칙은 A가 SSOT에 반영 |

**A가 D와 맞출 것:** 시뮬 세션 ID를 웹훅·워크스페이스에 전달하는 방식, 향후 Redis 채널명·스키마.

---

### 5-B. B(백엔드 & 데이터, 박준용)와 인터페이스

| 항목 | 규칙 |
|------|------|
| OpenAPI 정본 | [`specs/openapi/v1.yaml`](../../specs/openapi/v1.yaml) — D 표면 경로 포함 유지 |
| 계약 변경 | CI·`CONTRACT_CHANGED`·OpenAPI 동기화 ([`docs/backend/team-handshake.md`](../backend/team-handshake.md)) |
| 공유 타입 | [`specs/data-model/types.ts`](../../specs/data-model/types.ts) |

---

### 5-C. C(프론트엔드 & UX, 유소민)와 인터페이스

| 항목 | 규칙 |
|------|------|
| API 베이스 | `NEXT_PUBLIC_API_URL` ([`docs/fe-web-integration.md`](../fe-web-integration.md)) |
| 통합 이벤트 폴링 | `GET /api/integration/events` + Bearer |

---

## 6. CI 게이트 요약

```
PR 생성/업데이트
  └─ [CI: lint]        ─ 실패 시 merge 블록
  └─ [CI: typecheck]   ─ 실패 시 merge 블록
  └─ [CI: contract]    ─ 실패 시 merge 블록
  └─ [CI: build]       ─ 실패 시 merge 블록

(런타임) GitHub Webhook 수신 시
  └─ 정적 검증 실행 → SQLite integration_events + pr_validation_cache 갱신
  └─ (선택) sessionId=UUID → Postgres collaboration_events 미러
```

---

## 7. 변경 이력

| 날짜 | 변경 내용 | 담당자 |
|------|-----------|--------|
| 2026-04-10 | 초안 작성 | D |
| 2026-04-10 | SQLite 1차 스트림·포트 4000·Redis 역할 정정·엔드포인트 표 보강 | D (한승준) |
