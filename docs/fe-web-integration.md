# FE ↔ API 연동 가이드 (us-vibe)

웹 앱(`apps/web`)과 Nest API(`apps/api`)가 어떻게 붙는지, 환경 변수·인증·엔드포인트·로컬 실행 순서를 한곳에 정리한다.  
스펙 타입은 `specs/data-model/types.ts` 등 저장소 루트 `specs/`를 참고한다.

---

## 1. 아키텍처

| 구분 | 역할 |
|------|------|
| **Next.js (3000)** | UI, 브라우저 `sessionStorage`(학습 세션·로컬 목업 상태), `POST /api/chat`(OpenAI 호환, 서버만 키 사용) |
| **Nest API (4000)** | 세션 스토리 API, 통합 이벤트, 인증(JWT), SQLite 영속 |
| **연결** | `NEXT_PUBLIC_API_URL=http://localhost:4000` 일 때 fetch에 `Authorization: Bearer <JWT>` 자동 첨부(`lib/api-fetch.ts`) |

`NEXT_PUBLIC_API_URL`이 **없으면** 역할 결손·Prompt→Spec·PR·계약·회고 등은 **클라이언트 목업**으로 동작한다.

---

## 2. 환경 변수

### 웹 (`apps/web`, 예: `.env.local`)

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_API_URL` | 선택 | API 베이스 URL. **설정 시** 로그인/회원가입 후 JWT로 보호된 API를 호출한다. |
| `GEMINI_API_KEY` | 선택(채팅 권장) | Next `app/api/chat` — Google Gemini `generateContent`. **서버 전용.** |
| `GEMINI_MODEL` | 선택 | 기본 `gemini-2.0-flash` |
| `OPENAI_API_KEY` 등 | 선택 | Gemini 키가 없을 때만 OpenAI 호환 경로 사용 |

### API (`apps/api`, 예: `.env`)

| 변수 | 필수 | 설명 |
|------|------|------|
| `API_PORT` | 선택 | 기본 `4000` |
| `DATABASE_PATH` | 선택 | SQLite 파일. 기본 `data/usvibe.db` (워크스페이스·이벤트·사용자) |
| `JWT_SECRET` | **운영 필수** | JWT 서명. 미설정 시 개발용 기본값(프로덕션 금지) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | 선택 | 최초 기동 시 admin 계정 1명 시드 |
| `INTEGRATION_WEBHOOK_SESSION_ID` | 선택 | GitHub 웹훅 이벤트의 `sessionId` (기본 `github-ingest`) |
| `GITHUB_*` | 선택 | 웹훅·리포트 연동용 (기존 integration 모듈) |

---

## 3. 인증

1. `NEXT_PUBLIC_API_URL`이 있으면 **AuthGate** → (로그인/가입) → 온보딩 → 워크스페이스 순서다.
2. 토큰은 `sessionStorage` (`usvibe_access_token`, `usvibe_auth_user`).
3. API는 `Authorization: Bearer <token>`을 요구한다(세션 스토리·VFS·검증·통합 이벤트 조회 등).
4. 공개: `GET /health`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /webhooks/github` 등.

CORS는 API에서 `origin: true`, `credentials: true`로 설정되어 있다.

---

## 4. 엔드포인트 요약 (FE에서 쓰는 것 위주)

### 인증

| 메서드 | 경로 | 비고 |
|--------|------|------|
| POST | `/api/auth/register` | body: `{ email, password }` → HTTP **201** |
| POST | `/api/auth/login` | body: `{ email, password }` → `accessToken`, `user` |
| GET | `/api/auth/me` | Bearer 필요 |

### 스토리 (Bearer 필요)

| 메서드 | 경로 | FE 모듈 |
|--------|------|---------|
| GET | `/api/sessions/:sessionId/role-gap` | `role-gap-service.ts` |
| POST | `/api/sessions/:sessionId/prompt-spec/convert` | `prompt-spec-service.ts` |
| POST | `/api/sessions/:sessionId/prompt-spec/approve` | 동일 |
| GET | `/api/sessions/:sessionId/pr-review` | `pr-review-service.ts` |
| POST/PATCH | `.../pr-review/submit`, `.../comments/:id`, `re-review`, `final-approve` | 동일 |
| POST | `.../contract/validate`, `.../contract/approve` | `contract-gate-service.ts` |
| GET/POST | `.../retro/reports`, `.../retro/generate` | `retro-service.ts` |

### 통합·기타 (Bearer 필요인 경우)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/integration/events` | 통합 이벤트 로그 조회 |

### Next 전용 (브라우저 → 동일 오리진)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/chat` | OpenAI 호환 채팅(서버 키) |

응답 래핑은 대부분 `{ ok: true, data: ... }` 형태를 따른다.

---

## 5. 로컬 개발 순서

1. API: `npm run dev:api` (루트) 또는 `cd apps/api && npm run start:dev`
2. `JWT_SECRET` 설정 권장
3. 웹: `NEXT_PUBLIC_API_URL=http://localhost:4000` 후 `npm run dev:web`
4. 브라우저에서 회원가입 또는 로그인 후 스토리 패널 사용

---

## 6. 자동 테스트

루트에서 전체:

```bash
npm test
```

- **웹**: `apps/web` — `vitest`, 순수 함수 단위 (`lib/*.test.ts`)
- **API**: `apps/api` — `vitest` + `supertest`, 앱 기동 후 `health`·`auth`·`role-gap` 스모크

CI에서는 `npm run build`와 함께 `npm test`를 붙이면 된다.

---

## 7. 알려진 제한

- 학습 세션 `sessionId`는 클라이언트에서 생성한 UUID이며, API의 SQLite 행과 **사용자 계정 ID는 아직 강하게 묶이지 않는다**(향후 `user_id` 매핑 가능).
- GitHub 웹훅은 JWT 없이 동작한다(서명 시크릿 권장).

---

## 8. 관련 문서

- 설계: `docs/ai_협업_에이전트_설계_*.plan.md`
- 통합 샌드박스: `docs/integration-sandbox/`
