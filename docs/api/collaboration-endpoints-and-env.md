# 협업·인증 API 및 환경 변수 참고

노션에 복사해 쓰기 좋은 버전: [`collaboration-endpoints-notion.md`](./collaboration-endpoints-notion.md).

로컬 기본 베이스 URL: `http://localhost:4000` ([`apps/api` `main.ts`](../../apps/api/src/main.ts)에서 포트 4000).

계약의 정본(SSOT)은 OpenAPI: [`specs/openapi/v1.yaml`](../../specs/openapi/v1.yaml).

---

## 공통

| 항목 | 값 |
|------|-----|
| JSON 요청/응답 | `Content-Type: application/json` |
| 인증이 필요한 요청 | 헤더 `Authorization: Bearer <accessToken>` |
| 검증·계약 오류 본문 | `{ "code": string, "message": string }` ([`ContractHttpExceptionFilter`](../../apps/api/src/http-exception.filter.ts)) |

CORS는 API에서 활성화되어 있습니다.

---

## 엔드포인트 요약

| 메서드 | 경로 | 인증 | 요청 본문 (필드명) | 성공 응답 (필드명) | 비고 |
|--------|------|------|-------------------|-------------------|------|
| GET | `/health` | 없음 | — | `ok`, `service` | 서비스 살아 있음 |
| GET | `/health/db` | 없음 | — | `ok`, `database` (`up` \| `down`) | Postgres 연결 |
| GET | `/health/redis` | 없음 | — | `ok`, `redis` (`disabled` \| `up` \| `down`) | Redis(토큰 폐기) 연결 |
| POST | `/auth/register` | 없음 | `email`, `password` | `accessToken` | 201, 비밀번호 최소 8자 |
| POST | `/auth/login` | 없음 | `email`, `password` | `accessToken` | 200 |
| POST | `/auth/logout` | Bearer JWT | — | `ok` (항상 `true`) | Redis 설정 시 `jti` 폐기 |
| GET | `/users/me` | Bearer JWT | — | `id`, `email`, `createdAt` (ISO 문자열) | 현재 사용자 |
| POST | `/collaboration/events` | 없음* | `eventType` (필수), `payload` (선택), `sessionId` (선택) | `id`, `createdAt` (ISO 문자열) | 201, 협업·에이전트 이벤트 append |
| POST | `/sessions` | 없음* | `learningGoal`, `topic`, `sprintDuration`, `skillLevel` (필수), `learnerRole`, `activeRoles` (선택) | 세션 객체 (`id`, `currentGate`, `gateHistory`, …) | 201, Backend Solo 시뮬 세션 생성 (`currentGate` 초기 `A`) |
| GET | `/sessions/:id` | 없음* | — | 세션 객체 | 404 `SESSION_NOT_FOUND` |
| PATCH | `/sessions/:id` | 없음* | `targetGate` (선택), `implementationNotes` (선택), `retroSummary` (선택, `DONE` 전이 시 권장) | 세션 객체 | `B`→`C`는 PATCH 불가 → `POST .../verify` 사용 |
| POST | `/sessions/:id/implementation-ready` | 없음* | `{ notes? }` | 세션 객체 (`implementationAcknowledgedAt` 설정) | Gate **B**만; 아니면 400 `ACK_WRONG_GATE` |
| POST | `/sessions/:id/verify` | 없음* | — | 세션 객체 (`currentGate` `C`로 전이) | Gate **B** + 구현 확인 시각 필요 → 400 `IMPLEMENTATION_NOT_ACKNOWLEDGED`; 그 외 `VERIFY_WRONG_GATE` 등 |
| GET | `/sessions/:id/timeline` | 없음* | — | `collaboration_events` 행 배열 (`sessionId`가 `:id`와 일치) | 404 세션 없음; **폴링용 “알림” 스트림**으로 사용 |
| POST | `/sessions/:id/run-scenario` | 없음* | `{ skipImplementationWait?: boolean }` (선택) | `{ session, steps, pausedForImplementation? }` — 기본은 Gate **A**에서 인트로만(Gemini) 후 **B**에서 멈춤 (`pausedForImplementation: true`) | `skipImplementationWait: true`면 구현 확인 생략 후 검증+마무리까지 한 번에(데모). **503** 키 없음, **400** Gate·검증, **502** 모델 |
| POST | `/sessions/:id/run-scenario/finish` | 없음* | — | `{ session, steps }` — Gate **C**에서 Senior+회고 후 **DONE** | **400** `FINISH_WRONG_GATE` 등 |

\*현재 컨트롤러에 가드 없음. 운영에서 막으려면 OpenAPI/구현에 맞춰 Bearer를 추가하는 식으로 확장하면 됩니다.

**시나리오·게이트 흐름:** [`docs/user-scenario-backend-solo-mvp.md`](../user-scenario-backend-solo-mvp.md).

**Google AI / Gemini (후속):** 서버에서만 사용. API 키는 **`NEXT_PUBLIC_` 접두사 없이** 루트 `.env`에 둔다 (예: `GEMINI_API_KEY`). 브라우저에 노출하지 않는다.

---

## 필드·변수 이름 (JSON / 환경)

### 요청·응답 (camelCase)

- **인증**: `email`, `password`, `accessToken`
- **사용자**: `id`, `createdAt`
- **협업 이벤트**: `eventType`, `payload`, `sessionId` → 응답 `id`, `createdAt`
- **시뮬 세션(추가)**: `implementationAcknowledgedAt` (ISO 또는 `null`)
- **에러**: `code`, `message`

### JWT 페이로드 (내부)

[`JwtPayload`](../../apps/api/src/auth/auth.types.ts): `sub`(사용자 UUID), `email`, `jti`(폐기용 고유 ID).

### 환경 변수

| 변수 | 용도 | 비고 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | 기본값은 [`docker-compose.yml`](../../docker-compose.yml)의 `usvibe` DB와 동일 형식 |
| `JWT_SECRET` | JWT 서명 | 미설정 시 개발용 고정 문자열로 서명([`auth.module.ts`](../../apps/api/src/auth/auth.module.ts)); 운영에서는 반드시 설정 |
| `REDIS_URL` | 로그아웃 시 토큰 `jti` denylist | 없으면 Redis 미사용(`health/redis`는 `disabled`) |
| `TYPEORM_LOGGING` | SQL 로그 | `1` 이면 TypeORM 쿼리 로깅 |
| `GEMINI_API_KEY` | Google Gemini (`POST /sessions/:id/run-scenario`, `.../finish`) | 브라우저에 두지 말 것. 미설정 시 자동 시나리오는 **503** |
| `GEMINI_MODEL` | 선택 | 기본 `gemini-2.5-flash-lite` (503 완화). 더 큰 모델은 `gemini-2.5-flash` 등 ([모델 목록](https://ai.google.dev/gemini-api/docs/models)) |
| `GEMINI_FALLBACK_MODEL` | 선택 | 기본 `gemini-2.5-flash-lite`. 주 모델이 503로 끝까지 실패할 때 한 번 더 시도 |

템플릿: [`.env.example`](../../.env.example).

---

## 협업 이벤트 `eventType` 권장 값

에이전트·오케스트레이터 간 맞춤용 예약 값은 [`docs/backend/agent-event-log.md`](../backend/agent-event-log.md) 표를 따릅니다 (`supervisor_route`, `agent_reply`, `contract_violation`, `user_message` 등).

---

## 관련 코드

| 영역 | 위치 |
|------|------|
| 협업 HTTP | [`apps/api/src/collaboration/`](../../apps/api/src/collaboration/) |
| 인증 HTTP | [`apps/api/src/auth/`](../../apps/api/src/auth/) |
| DB 엔티티·append | [`src/backend/src/entities/collaboration-event.entity.ts`](../../src/backend/src/entities/collaboration-event.entity.ts), [`CollaborationEventsDataService`](../../src/backend/src/collaboration/collaboration-events-data.service.ts) |
| Redis 폐기 저장소 | [`RevokedTokenStore`](../../src/backend/src/redis/revoked-token.store.ts) |
