# FE ↔ API 연동 가이드 (us-vibe)

웹 앱(`apps/web`)과 Nest API(`apps/api`)가 어떻게 붙는지, 환경 변수·인증·로컬 실행 순서를 한곳에 정리한다.

**팀 공통 참고(엔드포인트 전체·변수 이름 규칙):** [`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md)  
스펙 타입은 `specs/data-model/types.ts` 등 저장소 루트 `specs/`를 참고한다.

---

## 1. 아키텍처

| 구분 | 역할 |
|------|------|
| **Next.js (3000)** | UI, 브라우저 `sessionStorage`(학습 세션·로컬 목업 상태), `POST /api/chat`(Gemini/OpenAI, **서버만** 키) |
| **Nest API (4000)** | 인증(JWT), Postgres(TypeORM·시뮬 세션·사용자), **SQLite 워크스페이스** 영속(PR·계약·회고 등), 통합 이벤트 |
| **연결** | `NEXT_PUBLIC_API_URL=http://localhost:4000` 일 때 `apiFetch`에 `Authorization: Bearer <JWT>` 자동 첨부([`lib/api-fetch.ts`](../apps/web/lib/api-fetch.ts)) |

`NEXT_PUBLIC_API_URL`이 **없으면** 역할 결손·Prompt→Spec·PR·계약·회고 등은 **클라이언트 목업**으로 동작한다.

---

## 2. 환경 변수 (요약)

전체 표·이름 규칙은 **[`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md) §3** 참고.

### 웹 (`apps/web`, 예: `.env.local`)

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_API_URL` | 선택 | API 베이스 URL. **설정 시** 로그인/회원가입 후 JWT로 보호된 API를 호출한다. |
| `NEXT_PUBLIC_API_BASE_URL` | 선택 | `/simulate` 등에서 사용 ([`api-base.ts`](../apps/web/lib/api-base.ts)). 미설정 시 `http://localhost:4000` 기본값. **연동 시 보통 `NEXT_PUBLIC_API_URL`과 동일**하게 둔다. |
| `GEMINI_API_KEY` | 선택(채팅 권장) | Next `app/api/chat` — **서버 전용.** |
| `GEMINI_MODEL` | 선택 | 기본값은 코드 참고 |
| `OPENAI_API_KEY` 등 | 선택 | Gemini 키가 없을 때만 OpenAI 호환 경로 |

### API / 루트 (`.env`)

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | 로컬 개발 권장 | **PostgreSQL** (TypeORM). [`docker-compose.yml`](../docker-compose.yml)와 맞출 것. |
| `JWT_SECRET` | **운영 필수** | JWT 서명 |
| `REDIS_URL` | 선택 | 로그아웃 시 토큰 `jti` 폐기 |
| `API_PORT` | 선택 | 기본 `4000` |
| `DATABASE_PATH` | 선택 | **SQLite** 워크스페이스 파일. 기본 `data/usvibe.db` 근처 ([`workspace-persistence.service.ts`](../apps/api/src/persistence/workspace-persistence.service.ts)) |
| `INTEGRATION_WEBHOOK_SESSION_ID` | 선택 | GitHub 웹훅 `sessionId` — **운영 모드 표는** [`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md) **§3.1** |
| `GITHUB_*` | 선택 | 웹훅·리포트 연동 |
| `INTEGRATION_REDIS_PUBLISHER` / `INTEGRATION_REDIS_CHANNEL` | 선택 | API 서버 — Pub/Sub 발행 시 아래 표 참고 |
| `INTEGRATION_BULLMQ` / `WEBHOOK_ALLOWLIST` / `WEBHOOK_TRUST_PROXY` / `WEBHOOK_VALIDATION_ASYNC` 등 | 선택 | GitHub → `POST /webhooks/github`·검증 큐·IP 하드닝. **FE는 웹훅을 직접 부르지 않음** — 통합 타임라인·SSE는 [`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md) §3, **리버스 프록시·IP 허용 순서는 같은 문서 절 3.2** |

---

## 3. 인증

1. `NEXT_PUBLIC_API_URL`이 있으면 **AuthGate** → (로그인/가입) → 온보딩 → 워크스페이스 순서다.
2. 토큰은 `sessionStorage` (`usvibe_access_token`, `usvibe_auth_user`).
3. 보호된 API는 `Authorization: Bearer <token>`을 요구한다.
4. 워크스페이스 FE는 **`/api/auth/*`** (응답 `{ ok, data }`). 기존 **`/auth/*`** 도 동일 JWT로 동작한다. **자세한 표:** [`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md) §4.

CORS는 API에서 `origin: true`, `credentials: true`로 설정되어 있다.

---

## 4. 엔드포인트 요약 (FE에서 쓰는 것 위주)

### 인증 (워크스페이스)

| 메서드 | 경로 | 비고 |
|--------|------|------|
| POST | `/api/auth/register` | body: `{ email, password }` → HTTP **201** |
| POST | `/api/auth/login` | body: `{ email, password }` |
| GET | `/api/auth/me` | Bearer 필요 |

### 스토리 (Bearer 필요)

| 메서드 | 경로 | FE 모듈 |
|--------|------|---------|
| GET | `/api/sessions/:sessionId/role-gap` | `role-gap-service.ts` |
| POST | `/api/sessions/:sessionId/prompt-spec/convert` | `prompt-spec-service.ts` |
| POST | `/api/sessions/:sessionId/prompt-spec/approve` | 동일 |
| GET | `/api/sessions/:sessionId/pr-review` | `pr-review-service.ts` |
| POST/PATCH | `.../pr-review/submit`, `.../comments/:commentId`, `re-review`, `final-approve` | 동일 |
| POST | `.../contract/validate`, `.../contract/approve` | `contract-gate-service.ts` |
| GET/POST | `.../retro/reports`, `.../retro/generate` | `retro-service.ts` |

### 통합·기타 (Bearer 필요인 경우)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/integration/events` | 통합 이벤트 로그 조회 |
| GET | `/api/integration/unified-timeline` | SQLite 이벤트 + Postgres `collaboration_events` 병합(세션 UUID일 때 후자) |
| GET | `/api/integration/stream?sessionId=<uuid>` | SSE Thought Stream — **세션 UUID 필수**(서버에서 소유 검사 후 Redis 이벤트를 해당 세션만 전달). 브라우저는 `EventSource` 대신 **fetch + Authorization** ([`integration-sse.ts`](../apps/web/lib/integration-sse.ts)) |
| GET | `/api/validation/status/{prNumber}` | PR 정적 검증 캐시 + `consecutiveFailures` 루프 가드 |
| POST | `/api/vfs/snapshot` | VFS 스냅샷 — 응답 `diffUrl`은 **API 기준 경로**이므로 전체 URL은 `NEXT_PUBLIC_API_URL` + `diffUrl` 결합 ([`vfs-api.ts`](../apps/web/lib/vfs-api.ts) `resolveVfsDiffUrl`) |
| GET/POST | `/api/vfs/diff/{id}`, `/api/vfs/approve/{id}` | Diff 조회 · 승인 |
| GET/PATCH | `/api/sessions/{id}/session-profile`, `.../workspace-gates`, `.../project-state` | Sprint1 역할·게이트·SSOT |
| POST | `/api/sessions/{id}/workspace-dod-verify` | 계약 스크립트 + 워크스페이스 게이트 DoD 검증 |

#### Redis Pub/Sub 및 SSE(`GET /api/integration/stream`) 페이로드

| 구분 | 내용 |
|------|------|
| **Pub/Sub 채널** | `INTEGRATION_REDIS_CHANNEL` — 기본 `integration:events`. 발행은 `INTEGRATION_REDIS_PUBLISHER=1` 이고 `REDIS_URL`이 있을 때만 ([`integration-redis-pubsub.service.ts`](../apps/api/src/integration/integration-redis-pubsub.service.ts)). |
| **메시지 본문** | **단일 JSON 문자열** 한 덩어리. 스키마는 SQLite에 append되는 것과 동일한 **`IntegrationEvent`** (`specs/data-model/types.ts`). 별도 봉투 키(`wrapper` 등) 없음. |
| **필드** | `type`, `sessionId`, `stateVersion`, `triggeredBy`, `payload`, `timestamp`(ISO 8601). |
| **에러·버전** | Redis 메시지에 HTTP 에러 코드를 실어 보내지 **않음**. 스트림 소비 실패는 연결/파싱 측에서 처리. |
| **SSE `data:` 줄** | (1) Redis에서 온 경우: 위 **IntegrationEvent JSON과 동일 문자열**. (2) 하트비트: `{"type":"heartbeat","redis":true\|false,"t":"<ISO>"}` ([`integration-stream.controller.ts`](../apps/api/src/integration/integration-stream.controller.ts)). |
| **클라이언트** | 브라우저는 `Authorization`이 필요하므로 `EventSource` 대신 **fetch + SSE 파싱** ([`integration-sse.ts`](../apps/web/lib/integration-sse.ts)). 쿼리 `sessionId`는 현재 워크스페이스 UUID와 일치해야 한다. |

#### 통합 타임라인 UI (제품 결정)

| 결정 | 내용 |
|------|------|
| **표시 방식** | 탭 두 개: **SQLite**(`integrationEvents`, 최신 먼저) / **Postgres**(`postgresTimeline`, `createdAt` 오름차순, `GET /sessions/:id/timeline`과 동일). 단일 병합 리스트는 추후 옵션. |
| **구현** | [`integration-tools-panel.tsx`](../apps/web/components/workspace/integration-tools-panel.tsx)「통합 타임라인」섹션. |
| **OpenAPI** | `GET /api/integration/unified-timeline` 응답의 `postgresTimeline` 항목은 `CollaborationEventTimelineItem` (`specs/openapi/v1.yaml`). |

#### 통합 이벤트 폴링

PR·정적 검증·VFS 관련 알림을 FE에서 따라갈 때는 **Bearer**로 다음을 주기적으로 호출할 수 있다.

- **요청:** `GET /api/integration/events?sessionId=<선택>&limit=<1–200, 기본 50>`
- **헤더:** `Authorization: Bearer <usvibe_access_token>` ([`lib/api-fetch.ts`](../apps/web/lib/api-fetch.ts)가 `NEXT_PUBLIC_API_URL` 설정 시 자동 첨부)
- **응답:** `{ ok: true, data: { events: IntegrationEvent[] } }` — 이벤트는 SQLite 기준 **최신이 먼저** 오며, 필드 정의는 `specs/data-model/types.ts`의 `IntegrationEvent` 참고.
- **sessionId:** 생략하면 DB 전역에서 최근 `limit`건(디버깅용). 운영·시뮬 정렬에는 GitHub 웹훅과 동일한 값으로 좁힌다 — [`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md) **§3.1** 및 [`session-id-sync.md`](integration-sandbox/session-id-sync.md).
- **Postgres 타임라인과의 관계:** `GET /sessions/:id/timeline`은 `collaboration_events`만 본다. 웹훅 `sessionId`를 시뮬 UUID로 맞추면 동일 이벤트가 Postgres에도 미러될 수 있다 — [`docs/integration-sandbox/event-vocabulary-map.md`](integration-sandbox/event-vocabulary-map.md).
- **워크스페이스 UI:** 스토리 탭 **「연동 · CI/이벤트」** 에서 위 API를 약 5초 간격으로 폴링한다([`integration-events-panel.tsx`](../apps/web/components/workspace/integration-events-panel.tsx)). 동일 탭에 PR 검증·VFS·통합 타임라인·SSE·게이트·DoD·ProjectState 패널이 있다([`integration-tools-panel.tsx`](../apps/web/components/workspace/integration-tools-panel.tsx)).

### Next 전용 (브라우저 → 동일 오리진)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/chat` | Gemini/OpenAI 호환 채팅(서버 키) |

응답 래핑은 대부분 `{ ok: true, data: ... }` 형태를 따른다.

**시뮬레이션 API·`POST /sessions` 등**은 [`collaboration-endpoints-and-env.md`](api/collaboration-endpoints-and-env.md) 참고.

---

## 5. 로컬 개발 순서

1. Postgres: `npm run db:up` 후 `npm run migrate` (루트 `package.json` 참고)
2. Redis(선택): `REDIS_URL` — 로그아웃 폐기용
3. API: `npm run dev:api` — 루트 `.env`에 `DATABASE_URL`, `JWT_SECRET` 권장
4. 웹: `NEXT_PUBLIC_API_URL=http://localhost:4000` 후 `npm run dev:web`
5. 브라우저에서 회원가입 또는 로그인 후 스토리 패널 사용

### 5.1 FE–BE 연동 스모크 (수동)

- [ ] `NEXT_PUBLIC_API_URL`이 API 베이스와 일치하고, 웹을 **재빌드**했다(`next dev`는 env 변경 후 재기동).
- [ ] 로그인 후 Bearer가 `apiFetch`에 붙는다(401 없이 `/api/auth/me` 등).
- [ ] 워크스페이스 **「연동 · CI/이벤트」** 탭에서 통합 이벤트 폴링이 동작한다(`GET /api/integration/events?sessionId=…`).
- [ ] GitHub 웹훅 이벤트를 같은 화면에서 보려면 API `INTEGRATION_WEBHOOK_SESSION_ID`를 **워크스페이스 학습 `sessionId`(UUID)** 와 동일하게 맞춘다 — [`session-id-sync.md`](integration-sandbox/session-id-sync.md), [`collaboration-env-and-endpoints.md`](collaboration-env-and-endpoints.md) §3.1.
- [ ] 스토리3에서 PR 제출 후, 동일 탭의 **PR 검증** 입력란에 스냅샷 PR 번호가 채워지고 `GET /api/validation/status/{pr}` 조회가 가능하다(F-4).
- [ ] (선택) `GET /api/integration/unified-timeline`, SSE `GET /api/integration/stream` — Redis·세션 UUID 여부에 따라 Postgres 타임라인/SSE가 비어 있을 수 있다(정상일 수 있음).

---

## 6. 자동 테스트

루트에서 전체:

```bash
npm test
```

- **웹**: `apps/web` — `vitest`, 순수 함수 단위 (`lib/*.test.ts`)
- **API**: `apps/api` — `vitest` + `supertest`. **Postgres가 `127.0.0.1:5432`에 없으면 e2e 3개는 자동 스킵**되고(실패 아님), DB를 올린 뒤에만 실제 HTTP 검증이 돈다.

CI에서는 `npm run build`와 함께 `npm test`를 붙이면 된다.

---

## 7. 알려진 제한

- 학습 세션 `sessionId`는 클라이언트에서 생성한 UUID이며, API의 SQLite 행과 **사용자 계정 ID는 아직 강하게 묶이지 않는다**(향후 `user_id` 매핑 가능). 웹훅·시스템 쓰기와 감사 정책은 [`integration-sandbox/system-writes-s1.md`](integration-sandbox/system-writes-s1.md) 참고.
- GitHub 웹훅은 JWT 없이 동작한다(서명 시크릿 권장).

### 7.1 학습 sessionId · 시뮬 · 웹훅 맞추기

UUID를 한 줄로 맞추는 절차는 [`docs/integration-sandbox/session-id-sync.md`](integration-sandbox/session-id-sync.md)를 본다. `INTEGRATION_WEBHOOK_SESSION_ID` 표준은 [`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md) §3.1.

### 7.2 워크스페이스 DoD 검증 vs 시뮬 `POST /sessions/:id/verify`

| 구분 | 경로 | 목적 |
|------|------|------|
| **워크스페이스 DoD** | `POST /api/sessions/{workspaceSessionId}/workspace-dod-verify` | SQLite 기준: Prompt-to-Spec 승인·계약 검증 통과 여부 + 루트 `scripts/validate-api-contract.js` 실행. **시뮬 게이트(B→C)를 자동으로 바꾸지 않음.** |
| **시뮬 검증** | `POST /sessions/{id}/verify` | Postgres `SimulationSession`: gate **B**일 때 계약 파일 존재·DB 핑 후 **C로 전진** ([`SessionsDataService.completeVerification`](../../src/backend/src/sessions/sessions-data.service.ts)). |

학습 시나리오에서 “게이트 C 진입”은 시뮬 API를 쓰는 경우 **verify**가 공식 경로이고, 워크스페이스 DoD는 **문서·계약·스크립트 준비 점검**용으로 병행한다. 둘을 하나의 버튼으로 합칠지는 추후 제품 결정.

---

## 8. 관련 문서

- **비전 백로그·FE/BE 큐:** [`vision-product-backlog.md`](./vision-product-backlog.md), [`handoff-fe-be-collaboration-recommendations.md`](./handoff-fe-be-collaboration-recommendations.md)
- **살아 있는 설계 역반영:** [`design-living-revisions.md`](./design-living-revisions.md)
- **협업 통합·엔드포인트·변수명:** [`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md)
- **세션 ID 동기화(학습·시뮬·웹훅):** [`integration-sandbox/session-id-sync.md`](integration-sandbox/session-id-sync.md)
- 설계: `docs/ai_협업_에이전트_설계_*.plan.md`
- 통합 샌드박스: `docs/integration-sandbox/`
