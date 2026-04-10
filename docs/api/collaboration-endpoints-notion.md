# US Vibe — 협업·인증 API · 환경 변수 (노션용)

저장소 안의 원본 참고 문서: `docs/api/collaboration-endpoints-and-env.md`

---

## 베이스 URL · API 계약

- **로컬 API 베이스 URL:** `http://localhost:4000`
- **OpenAPI 정본(스키마):** 저장소 루트의 `specs/openapi/v1.yaml`
- **CORS:** API에서 허용됨

---

## 공통 규칙

- **형식:** 요청·응답 본문은 JSON (`Content-Type: application/json`)
- **인증 헤더:** `Authorization: Bearer <accessToken>`
- **에러 본문 형태:** `{ "code": "문자열", "message": "문자열" }`
- **JSON 필드 이름:** 모두 **camelCase** (`accessToken`, `eventType` 등)

---

## 엔드포인트 목록

아래 경로는 모두 베이스 URL 뒤에 붙입니다. (예: `http://localhost:4000/health`)

### 헬스 체크

| 메서드 | 경로 | 인증 | 응답 필드 요약 |
| --- | --- | --- | --- |
| `GET` | `/health` | 없음 | `ok`, `service` |
| `GET` | `/health/db` | 없음 | `ok`, `database` — 값: `up` 또는 `down` |
| `GET` | `/health/redis` | 없음 | `ok`, `redis` — 값: `disabled`, `up`, `down` 중 하나 |

### 인증

| 메서드 | 경로 | 인증 | 요청 본문 | 성공 응답 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/auth/register` | 없음 | `email`, `password` | `accessToken` | HTTP **201**, 비밀번호 최소 8자 |
| `POST` | `/auth/login` | 없음 | `email`, `password` | `accessToken` | HTTP **200** |
| `POST` | `/auth/logout` | Bearer JWT | 없음 | `ok` (항상 `true`) | Redis 설정 시 토큰 `jti` 폐기 |

### 사용자

| 메서드 | 경로 | 인증 | 성공 응답 필드 |
| --- | --- | --- | --- |
| `GET` | `/users/me` | Bearer JWT | `id`, `email`, `createdAt` (ISO 날짜 문자열) |

### 협업 이벤트 로그

| 메서드 | 경로 | 인증 | 요청 본문 | 성공 응답 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/collaboration/events` | 없음* | 아래 표 참고 | `id`, `createdAt` (ISO) | HTTP **201**, DB에 append-only 저장 |

\*현재 구현은 인증 없이 호출 가능. 운영에서 막으려면 이후 Bearer 가드 등으로 확장하면 됨.

**`POST /collaboration/events` 요청 필드**

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `eventType` | 예 | 문자열, 공백만 불가 (비면 400) |
| `payload` | 아니오 | JSON 객체 (자유 형식) |
| `sessionId` | 아니오 | 문자열 또는 `null` |

### 시뮬레이션 세션 (Backend Solo MVP)

| 메서드 | 경로 | 인증 | 요약 |
| --- | --- | --- | --- |
| `POST` | `/sessions` | 없음* | `learningGoal`, `topic`, `sprintDuration`, `skillLevel` 필수 → 세션 생성 (`currentGate` `A`) |
| `GET` | `/sessions/:id` | 없음* | 세션 조회 (폴링에 사용) |
| `PATCH` | `/sessions/:id` | 없음* | `targetGate`, `implementationNotes`, `retroSummary` (B→C는 `POST .../verify`만) |
| `POST` | `/sessions/:id/implementation-ready` | 없음* | Gate **B**에서 구현 완료 표시 → `implementationAcknowledgedAt` |
| `POST` | `/sessions/:id/verify` | 없음* | Gate **B** + 구현 확인 후 계약 파일 + DB 검증 → `C` |
| `GET` | `/sessions/:id/timeline` | 없음* | 해당 `sessionId`의 협업 이벤트 시간순 (폴링 “알림”) |
| `POST` | `/sessions/:id/run-scenario` | 없음* | 기본: 인트로만 후 **B**에서 멈춤 (`pausedForImplementation`). 선택 본문 `{ "skipImplementationWait": true }` 데모 원샷 |
| `POST` | `/sessions/:id/run-scenario/finish` | 없음* | Gate **C**에서 Senior+회고 → **DONE** |

시나리오: `docs/user-scenario-backend-solo-mvp.md`

---

## 필드 이름 치트시트 (camelCase)

- **로그인·회원가입:** `email`, `password` → 응답 `accessToken`
- **내 정보:** `id`, `email`, `createdAt`
- **협업 이벤트:** 요청 `eventType`, `payload`, `sessionId` → 응답 `id`, `createdAt`
- **세션:** `learnerRole`, `learningGoal`, `topic`, `sprintDuration`, `skillLevel`, `activeRoles`, `currentGate`, `gateHistory`, `implementationNotes`, `implementationAcknowledgedAt`, `retroSummary`
- **에러:** `code`, `message`

---

## JWT 페이로드 (내부 구조)

토큰을 디코딩했을 때 쓰이는 클레임 예시 개념:

- `sub` — 사용자 UUID
- `email` — 이메일
- `jti` — 토큰별 고유 ID (로그아웃 시 Redis denylist에 사용)

코드 기준 타입: `apps/api/src/auth/auth.types.ts`

---

## 환경 변수

| 변수명 | 용도 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 접속 URL (로컬 기본은 `docker-compose.yml`의 Postgres `usvibe` DB와 맞춤) |
| `JWT_SECRET` | JWT 서명 비밀값. **미설정 시 개발용 고정 문자열**로 동작 (`apps/api/src/auth/auth.module.ts`) — 운영에서는 반드시 설정 |
| `REDIS_URL` | 로그아웃 시 `jti` 폐기 목록. 없으면 Redis 미사용, `/health/redis`는 `disabled` 쪽으로 표시 |
| `TYPEORM_LOGGING` | `1` 이면 SQL 쿼리 로그 출력 |
| `GEMINI_API_KEY` | `POST /sessions/:id/run-scenario` 자동 진행 시 필수. **`NEXT_PUBLIC_` 금지** |
| `GEMINI_MODEL` | 선택, 기본 `gemini-2.5-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | 선택, 기본 `gemini-2.5-flash-lite` (주 모델 503 시 재시도) |

예시 템플릿: 저장소 루트 `.env.example`  
Redis 동작 상세: `docs/backend/redis-usage.md`

---

## `eventType` 권장 값 (오케스트레이터 합의)

다음 값은 팀 맞춤용으로 예약. **추가·변경은 A(오케스트레이터) 승인 후** 권장.

| `eventType` | 언제 쓰면 되는지 |
| --- | --- |
| `supervisor_route` | Supervisor가 어떤 에이전트로 보낼지·근거 요약을 정했을 때 |
| `agent_reply` | 에이전트가 사용자/도구에 보이는 응답 조각을 냈을 때 |
| `contract_violation` | OpenAPI·데이터 모델·SSOT와 충돌하는 출력이 있을 때 |
| `kickoff_complete` | 킥오프·Gate A 범위 확정 등 (선택) |
| `review_passed` / `review_failed` | 리뷰 게이트 결과 (선택) |
| `retro_complete` | 회고 완료 (선택) |
| `user_message` | 최종 사용자(학습자) 메시지가 세션에 들어왔을 때 |

그 외 임의 문자열도 API는 받아들임 (실험용). 분석·대시보드에서는 위 표준 값을 우선 쓰는 것이 좋음.

**실패 정책 요약**

- `eventType`이 비어 있으면 **400** + `{ code, message }`
- DB 오류는 **500** 계열로 전파
- 이벤트 유실을 막으려면 클라이언트에서 재시도 + (향후) `payload` 안에 idempotency 키 두는 방식을 검토

---

## 저장소에서 코드 찾을 때

- 협업 API: `apps/api/src/collaboration/`
- 인증 API: `apps/api/src/auth/`
- 이벤트 엔티티·저장: `src/backend/src/entities/collaboration-event.entity.ts`, `src/backend/src/collaboration/collaboration-events-data.service.ts`
- Redis 토큰 폐기: `src/backend/src/redis/revoked-token.store.ts`
- HTTP 예외 형식: `apps/api/src/http-exception.filter.ts`
