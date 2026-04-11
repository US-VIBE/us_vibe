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
| `INTEGRATION_WEBHOOK_SESSION_ID` | 선택 | GitHub 웹훅 `sessionId` (기본 `github-ingest`) |
| `GITHUB_*` | 선택 | 웹훅·리포트 연동 |

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

#### 통합 이벤트 폴링

PR·정적 검증·VFS 관련 알림을 FE에서 따라갈 때는 **Bearer**로 다음을 주기적으로 호출할 수 있다.

- **요청:** `GET /api/integration/events?sessionId=<선택>&limit=<1–200, 기본 50>`
- **헤더:** `Authorization: Bearer <usvibe_access_token>` ([`lib/api-fetch.ts`](../apps/web/lib/api-fetch.ts)가 `NEXT_PUBLIC_API_URL` 설정 시 자동 첨부)
- **응답:** `{ ok: true, data: { events: IntegrationEvent[] } }` — 이벤트는 SQLite 기준 **최신이 먼저** 오며, 필드 정의는 `specs/data-model/types.ts`의 `IntegrationEvent` 참고.
- **sessionId:** 생략하면 DB 전역에서 최근 `limit`건(디버깅용). 운영·시뮬 정렬에는 GitHub 웹훅과 동일한 값으로 좁힌다 — 환경 변수 `INTEGRATION_WEBHOOK_SESSION_ID`(미설정 시 서버 기본 `github-ingest`) 또는 **실제 시뮬 세션 UUID**([`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md) §3).
- **Postgres 타임라인과의 관계:** `GET /sessions/:id/timeline`은 `collaboration_events`만 본다. 웹훅 `sessionId`를 시뮬 UUID로 맞추면 동일 이벤트가 Postgres에도 미러될 수 있다 — [`docs/integration-sandbox/event-vocabulary-map.md`](integration-sandbox/event-vocabulary-map.md).
- **워크스페이스 UI:** 스토리 탭 **「연동 · CI/이벤트」** 에서 위 API를 약 5초 간격으로 폴링한다([`integration-events-panel.tsx`](../apps/web/components/workspace/integration-events-panel.tsx)).

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

- 학습 세션 `sessionId`는 클라이언트에서 생성한 UUID이며, API의 SQLite 행과 **사용자 계정 ID는 아직 강하게 묶이지 않는다**(향후 `user_id` 매핑 가능).
- GitHub 웹훅은 JWT 없이 동작한다(서명 시크릿 권장).

---

## 8. 관련 문서

- **협업 통합·엔드포인트·변수명:** [`collaboration-env-and-endpoints.md`](./collaboration-env-and-endpoints.md)
- 설계: `docs/ai_협업_에이전트_설계_*.plan.md`
- 통합 샌드박스: `docs/integration-sandbox/`
