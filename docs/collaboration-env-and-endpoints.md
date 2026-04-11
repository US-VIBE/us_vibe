# 협업 참고: 환경 변수·엔드포인트·이름 규칙

팀이 **같은 URL·같은 변수 이름**으로 말할 수 있도록 정리한 문서다.  
세부 계약의 정본(SSOT)은 **`specs/openapi/v1.yaml`** 이고, 시뮬레이션 세션·게이트 흐름은 **`docs/api/collaboration-endpoints-and-env.md`** 를 본다.

---

## 1. 베이스 URL·포트

| 구분 | 기본값 | 설정 |
|------|--------|------|
| Nest API | `http://localhost:4000` | 루트 `.env` / 환경의 `API_PORT` (미설정 시 `4000`) |
| Next.js 웹 | `http://localhost:3000` | Next 기본 |
| PostgreSQL | `127.0.0.1:5432` | `DATABASE_URL` ([`docker-compose.yml`](../docker-compose.yml)와 맞출 것) |

워크스페이스 UI가 API를 부를 때 브라우저에 넣는 값은 **`NEXT_PUBLIC_API_URL`** (끝에 `/` 없이).

---

## 2. 이름 규칙 (팀 합의용)

### 환경 변수

| 규칙 | 설명 |
|------|------|
| **`NEXT_PUBLIC_` 접두사** | **브라우저 번들에 노출**된다. API 키·JWT 시크릿·DB 비밀번호는 **절대** 붙이지 않는다. |
| **서버 전용** | `GEMINI_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `GITHUB_*` 등은 **루트 `.env` 또는 API 실행 환경**에만 둔다. |

### JSON / TypeScript

| 규칙 | 예 |
|------|-----|
| HTTP JSON 필드 | **camelCase** (`accessToken`, `sessionId`, `createdAt`) |
| 에러 본문(계약 필터 통과 시) | `code`, `message` ([`ContractHttpExceptionFilter`](../apps/api/src/http-exception.filter.ts)) |
| JWT 페이로드(내부) | `sub`, `email`, `jti` ([`auth.types.ts`](../apps/api/src/auth/auth.types.ts)) |

### 브라우저 저장소 (웹)

| 키 | 용도 |
|----|------|
| `usvibe_access_token` | API용 Bearer 토큰 (`sessionStorage`) |
| `usvibe_auth_user` | 로그인 사용자 요약 (`sessionStorage`) |

---

## 3. 환경 변수 목록 (역할별)

### 루트 `.env` (API + `@us-vibe/backend` TypeORM·Redis 등)

`[.env.example`](../.env.example)를 복사해 쓴다.

| 변수명 | 용도 |
|--------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 (사용자·시뮬 세션·협업 이벤트 등) |
| `JWT_SECRET` | JWT 서명 (**운영 필수**) |
| `REDIS_URL` | 로그아웃 시 `jti` 폐기(denylist). 없으면 Redis 미사용 |
| `GEMINI_API_KEY` | API 쪽 Gemini (`/sessions/.../run-scenario` 등). **서버만** |
| `GEMINI_MODEL` | 선택, 기본은 코드 기본값 따름 |
| `GEMINI_FALLBACK_MODEL` | 선택 |
| `TYPEORM_LOGGING` | `1`이면 SQL 로그 |
| `US_VIBE_REPO_ROOT` | 모노레포 루트 오버라이드(일부 스크립트) |

### `apps/web` (`.env.local` — 예: [`apps/web/.env.example`](../apps/web/.env.example))

| 변수명 | 용도 |
|--------|------|
| `NEXT_PUBLIC_API_URL` | **워크스페이스**가 Nest API를 호출할 베이스 URL. 없으면 스토리·PR 등 **클라이언트 목업** |
| `NEXT_PUBLIC_API_BASE_URL` | **`/simulate` 등**에서 쓰는 API 베이스(문서/코드 병행). 미설정 시 코드 기본값 |
| `GEMINI_API_KEY` | Next **`/api/chat`** (서버 라우트만 사용). 브라우저로 키가 나가지 않음 |
| `GEMINI_MODEL` | 채팅 모델 |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | Gemini 미설정 시 OpenAI 호환 경로 |

### `apps/api` 전용 (SQLite 워크스페이스 영속)

[`apps/api/.env.example`](../apps/api/.env.example) 참고.

| 변수명 | 용도 |
|--------|------|
| `API_PORT` | API 리슨 포트 (기본 `4000`) |
| `DATABASE_PATH` | **SQLite** 파일 경로 (PR·계약·회고 스냅샷 등 워크스페이스 로컬 DB). 기본 `data/usvibe.db` 근처 |
| `INTEGRATION_WEBHOOK_SESSION_ID` | GitHub 웹훅이 발행하는 `IntegrationEvent.sessionId`. 미설정 시 `github-ingest`. **`GET /sessions/:id/timeline`(Postgres)과 같은 세션으로 보이게 하려면 실제 시뮬 세션 UUID**로 둔다. 그렇지 않으면 SQLite `integration_events`와 타임라인은 분리된다. |
| `VFS_STORAGE_PATH` | VFS 스냅샷 저장 경로 ([vfs](../apps/api/src/integration/vfs.service.ts)) |
| `GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME` | 연동·리포트 ([webhook](../apps/api/src/integration/webhook.controller.ts) 등) |
| `GITHUB_WEBHOOK_REQUIRE_SIGNATURE` | (선택) `1`/`true`이면 **`GITHUB_WEBHOOK_SECRET` 비어 있을 때 웹훅 요청 거부**(운영에서 서명 없이 열리지 않음). 미설정 시 기존처럼 시크릿 없으면 서명 검증 생략 |
| `WEBHOOK_VALIDATION_MAX_MS` | (선택) PR 정적 검증 `runAll` 동기 레이스 상한(ms). 기본 `28000`. 초과 시 **P-2:** 인메모리 큐로 이관 후 HTTP는 이미 200이면 백그라운드에서 계속 |
| `WEBHOOK_VALIDATION_ASYNC` | (선택) `1`/`true`이면 PR 이벤트 발행 후 **정적 검증은 프로세스 내 순차 큐**에서 실행·HTTP는 빨리 200 |
| `INTEGRATION_REDIS_PUBLISHER` | `1` 또는 `true`이고 `REDIS_URL`이 있으면 통합 이벤트를 Pub/Sub로도 발행 |
| `INTEGRATION_REDIS_CHANNEL` | (선택) Pub/Sub 채널명. 기본 `integration:events` |
| `INTEGRATION_REDIS_PUBLISH_MAX_ATTEMPTS` | (선택) Pub/Sub `publish` 실패 시 **P-1** 동일 프로세스 재시도 횟수. 기본 `3` |
| `INTEGRATION_REDIS_PUBLISH_BACKOFF_MS` | (선택) P-1 재시도 **초기 대기(ms)**. 지수 백오프(×2) 적용. 기본 `100` |
| `US_VIBE_REPO_ROOT` | (선택) 모노레포 루트 — push 웹훅에서 `code-delta-analyzer.js` 실행 시 `package.json` name `us-vibe` 탐색 실패 시 지정 |

### 3.1 `INTEGRATION_WEBHOOK_SESSION_ID` 운영 정책 (단일 기준)

| 모드 | 권장 값 | 효과 |
|------|---------|------|
| **기본(미설정)** | 코드 기본값 `github-ingest` | 웹훅 이벤트는 SQLite `integration_events`에만 쌓임. [`IntegrationTimelineBridgeService`](../apps/api/src/integration/integration-timeline-bridge.service.ts)는 **UUID v4가 아니면 Postgres `collaboration_events`로 미러하지 않음** — [`event-vocabulary-map.md`](integration-sandbox/event-vocabulary-map.md). |
| **풀스택 데모·로컬 학습** | **워크스페이스 학습 세션 UUID** = **`POST /sessions`로 만든 시뮬 세션 UUID**와 동일 문자열 | 동일 `sessionId`로 SQLite 스트림·Postgres 타임라인·[`GET /api/integration/unified-timeline`](../apps/api/src/integration/integration-events.controller.ts)의 `postgresTimeline`이 의미 있게 채워짐. 워크스페이스 탭「연동」과 `/simulate` 타임라인을 한 줄로 맞출 때 이 모드 사용. |
| **CI / 웹훅 단독 스모크** | `github-ingest` 유지 또는 전용 테스트용 비UUID 문자열 | Postgres 세션 없이도 웹훅·정적 검증 파이프만 검증 가능. 타임라인 병합은 기대하지 않음. |
| **스테이징·운영** | 제품 정책에 따라 (1) 시뮬 UUID 1:1 매핑 또는 (2) 인입 소스별 고정 비UUID + 통합 뷰는 SQLite만 | (2)일 때는 `unified-timeline`의 `postgresNote`를 사용자에게 노출하는 현 동작을 전제로 한다. |

**정리:** “한 화면에서 GitHub 연동 + 시뮬 게이트 타임라인”을 보려면 **반드시 UUID 모드**로 맞춘다. 그 외에는 기본 `github-ingest`로도 인테그레이션 파이프 자체는 동작한다.

---

## 4. 인증: 두 가지 HTTP 표면

같은 JWT를 쓰되, 워크스페이스 FE와 레거시/문서 경로가 나뉜다.

| 용도 | 메서드 | 경로 | 성공 응답 형태 |
|------|--------|------|----------------|
| **FE 워크스페이스** (`lib/auth-api.ts`) | POST | `/api/auth/register` | `{ ok: true, data: { accessToken, user: { id, email, role } } }` (가입은 201) |
| 동일 | POST | `/api/auth/login` | 위와 동일 |
| 동일 | GET | `/api/auth/me` | Bearer 필요 · `{ ok, data: { user } }` |
| **백엔드·문서 표준** | POST | `/auth/register` | `{ accessToken }` (201) |
| 동일 | POST | `/auth/login` | `{ accessToken }` |
| 동일 | POST | `/auth/logout` | Bearer 필요 · `{ ok: true }` |
| 사용자 정보 (Postgres) | GET | `/users/me` | Bearer · 사용자 엔티티 필드 |

`role`은 FE 응답 호환용으로 **`learner` 고정**일 수 있다( DB 스키마와 별도).

---

## 5. 엔드포인트 맵 (요약)

### 5.1 헬스

| 메서드 | 경로 | 인증 |
|--------|------|------|
| GET | `/health` | 없음 |
| GET | `/health/db` | 없음 |
| GET | `/health/redis` | 없음 |

### 5.2 시뮬레이션 세션 (Backend Solo·게이트)

`POST /sessions`, `GET/PATCH /sessions/:id`, `POST /sessions/:id/verify`, `POST .../run-scenario` 등 **전체 표**는  
**[`docs/api/collaboration-endpoints-and-env.md`](api/collaboration-endpoints-and-env.md)** § 엔드포인트 요약.

### 5.3 워크스페이스 세션 (스토리·PR·계약·회고)

베이스: **`/api/sessions`** — 대부분 **Bearer** 필요 ([`JwtAuthGuard`](../apps/api/src/auth/jwt-auth.guard.ts)).

| 메서드 | 경로 | 비고 |
|--------|------|------|
| GET | `/api/sessions/:sessionId/role-gap` | 역할 결손 |
| POST | `/api/sessions/:sessionId/prompt-spec/convert` | body: `promptText` 등 |
| POST | `/api/sessions/:sessionId/prompt-spec/approve` | |
| GET | `/api/sessions/:sessionId/pr-review` | |
| POST | `/api/sessions/:sessionId/pr-review/submit` | |
| PATCH | `/api/sessions/:sessionId/pr-review/comments/:commentId` | |
| POST | `/api/sessions/:sessionId/pr-review/re-review` | |
| POST | `/api/sessions/:sessionId/pr-review/final-approve` | |
| POST | `/api/sessions/:sessionId/contract/validate` | |
| POST | `/api/sessions/:sessionId/contract/approve` | |
| GET | `/api/sessions/:sessionId/retro/reports` | |
| POST | `/api/sessions/:sessionId/retro/generate` | |

FE 모듈 매핑: [`docs/fe-web-integration.md`](fe-web-integration.md) §4.

### 5.4 통합·VFS·검증

| 메서드 | 경로 | 인증 |
|--------|------|------|
| GET | `/api/integration/events` | Bearer (구현 기준) |
| POST | `/api/vfs/snapshot` | Bearer |
| GET | `/api/vfs/diff/:snapshotId` | Bearer |
| POST | `/api/vfs/approve/:snapshotId` | Bearer |
| GET | `/api/validation/status/:prNumber` | Bearer |
| POST | `/webhooks/github` | 웹훅 시크릿(구현 기준), JWT 아님 |

### 5.5 협업 이벤트 append

| 메서드 | 경로 | 비고 |
|--------|------|------|
| POST | `/collaboration/events` | 자세한 필드는 OpenAPI·협업 문서 |

### 5.6 Next (브라우저 → 동일 오리진)

| 메서드 | 경로 | 비고 |
|--------|------|------|
| POST | `/api/chat` | 서버만 키 사용 (Gemini/OpenAI) |

---

## 6. 관련 문서 링크

| 문서 | 내용 |
|------|------|
| [`fe-web-integration.md`](fe-web-integration.md) | FE ↔ Nest 연동 순서·`apiFetch`·테스트 |
| [`api/collaboration-endpoints-and-env.md`](api/collaboration-endpoints-and-env.md) | 시뮬 세션·인증·Postgres·Redis 상세 |
| [`api/collaboration-endpoints-notion.md`](api/collaboration-endpoints-notion.md) | 노션 복사용 |
| [`user-scenario-backend-solo-mvp.md`](user-scenario-backend-solo-mvp.md) | 시나리오·`/simulate` |
| [`backend/agent-event-log.md`](backend/agent-event-log.md) | `eventType` 권장 값 |
| [`specs/openapi/v1.yaml`](../specs/openapi/v1.yaml) | OpenAPI 정본 |

---

## 7. 변경 시

- 엔드포인트나 환경 변수를 바꾸면 **이 문서**와 **`fe-web-integration.md`**, 필요 시 **`specs/openapi/v1.yaml`** 을 같이 갱신한다.
