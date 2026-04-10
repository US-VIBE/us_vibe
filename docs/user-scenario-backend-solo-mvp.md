# User Scenario (Backend Solo MVP)

백엔드 1인 학습자가 협업 시뮬레이터에서 실제 팀처럼 프로젝트를 진행하는 기본 흐름을 정의한다.

## SSOT (경로·상태)

- **HTTP API 계약(엔드포인트 이름·스키마)**: [`specs/openapi/v1.yaml`](../specs/openapi/v1.yaml)가 정본이다. 시나리오 본문의 `POST /auth/signup` 등은 **교육용 표현**일 수 있으며, **현행 구현은 `POST /auth/register`** 를 사용한다. 별칭 경로가 필요하면 Gate B 승인 후 OpenAPI와 함께 변경한다.
- **런타임 시뮬레이션 상태(게이트·세션 컨텍스트)**: PostgreSQL `simulation_sessions` 테이블이 진실원이다. [`.ai/project-state.md`](../.ai/project-state.md)는 사람·에이전트용 요약·체크리스트로만 쓰고, 앱 로직은 DB를 따른다.

## 백엔드(B) 1차 슬라이스 API (구현 기준)

| 단계 | 시나리오 | API |
|------|----------|-----|
| 1–2 | 시작 입력·역할 배정 | `POST /sessions`, `GET /sessions/:id` |
| 3–5 | 킥오프·계약·구현 | 기존 `POST /collaboration/events` + `PATCH /sessions/:id` (`implementationNotes` 등) |
| 5b | 구현 완료(사람 단계) | `POST /sessions/:id/implementation-ready` — Gate **B**에서만; DB에 확인 시각 기록 후에야 검증 허용 |
| 6 | 완료 감지 | `POST /sessions/:id/verify` — Gate **B** + 구현 확인 후 계약 파일 존재 + DB ping, 성공 시 `C` |
| 7–9 | 리뷰·회고 | `POST /sessions/:id/run-scenario/finish` (Gate **C**, Gemini)가 Senior 발화·게이트 전이·회고 요약을 처리; 수동으로는 `PATCH /sessions/:id` 로 `C`→`D`→`DONE` 전이도 가능 |
| 8 (대체) | 알림 | `GET /sessions/:id/timeline` + `GET /sessions/:id` **폴링** (웹 라우트 `/simulate`, 소스 [`apps/web/app/simulate/page.tsx`](../apps/web/app/simulate/page.tsx)). 푸시는 후속 |
| 자동 데모 | **Gemini** (`GEMINI_API_KEY` 설정 시) | `POST /sessions/:id/run-scenario` — 기본: 세션 **Gate A**에서 킥오프·계약 AI만 돌리고 **B에서 멈춤**. 이후 `implementation-ready` → `verify` → `run-scenario/finish`. 본문 `{ "skipImplementationWait": true }`면 예전처럼 한 요청으로 끝까지(데모). 키 없으면 **503** `AI_NOT_CONFIGURED`. |

---

## 1) 시작 화면 (System Context 입력)

사용자가 웹에 처음 들어오면 아래를 입력한다.

- 학습자 역할: Backend Developer (고정)
- 학습 목표: 실무 협업 경험
- 주제: 예) 로그인/회원가입 기능
- 스프린트 시간: 예) 1일 또는 3일
- 숙련도: 초급/중급/고급

시스템은 입력을 바탕으로 역할 결손을 자동 계산하고 AI 역할군을 활성화한다.

**활성화 역할:** PM, FE, QA, Senior, Supervisor, Coach

---

## 2) 역할 자동 배정 (1인 기준)

백엔드 1인 기준에서는 나머지 역할이 자동으로 정해진다.

| 역할 | 역할 |
|------|------|
| PM | 일정/우선순위/회의 진행 |
| FE | API 소비 관점 요구사항 제시 |
| QA | 테스트/예외 케이스 검증 |
| Senior | 설계/코드 리뷰 및 컨펌 |
| Supervisor | 턴 조정/충돌 정리 |
| Coach | 세션 후 학습 피드백 |

---

## 3) 킥오프 회의 (PM 주도)

PM이 먼저 프로젝트의 큰 틀을 제시한다.

- **목표:** “이번 스프린트에서 로그인 기능 배포 가능 상태 달성”
- **범위:** 회원가입, 로그인, 토큰 발급, 기본 에러 처리
- **일정:** 설계 → 구현 → 리뷰 → QA → 회고

**회의 결과:**

- Gate A(요구사항 확정) 체크
- 백엔드 학습자의 구현 책임 범위 확정

---

## 4) 계약 회의 (FE/QA 참여)

FE와 QA가 API 계약 기준으로 질문한다.

- **FE:** 요청/응답 필드, 실패 응답 포맷, 토큰 저장 정책 질의
- **QA:** 유효성 실패/인증 실패/중복 가입 예외 케이스 질의

**결과:**

- `specs/openapi/v1.yaml` 업데이트
- `specs/api-contract.md` 확정
- Gate B(계약 승인) 체크

---

## 5) 구현 단계 (Backend Solo 구현)

백엔드 학습자가 로그인 기능을 구현한다.

**예시 구현 항목**

- `POST /auth/register` (시나리오 상 “signup”에 대응하는 **현행** 경로)
- `POST /auth/login`
- 비밀번호 검증
- JWT 발급
- 공통 에러 응답 포맷

**진행 중 이벤트:**

- PM: 일정 알림/진행률 체크
- FE: 연동 관점 보완 요청
- QA: 테스트 포인트 사전 공유

---

## 5b) 구현 완료 표시 (API)

채팅 입력 대신 **`POST /sessions/:id/implementation-ready`** 로 Gate **B**에서 구현 종료를 기록한다. 이후에만 `verify`가 허용된다(데모 스킵 제외).

## 6) 완료 감지 (자동 게이트)

학습자가 구현 완료를 기록한 뒤 시스템이 자동 검증을 수행한다.

- 헬스/DB 연결에 준하는 검증 및 계약 파일 존재 확인
- OpenAPI 대비 정적 검증 강화는 D(인테그레이션) 파이프라인에서 확장
- 실패 시 QA가 재현 리포트 발행
- 통과 시 Gate C(리뷰) 단계로 전환한다.

---

## 7) 리뷰/컨펌 (Senior + QA)

Senior가 컨펌 전 리뷰를 수행한다.

- 성능/보안/유지보수성 관점 피드백
- 예: 에러 처리 일관성, 인증 미들웨어 분리, 확장성 점검

QA는 통합 검증 결과를 전달한다.

- 실패 시 수정 요청 → 재검증 루프
- 통과 시 “로그인 기능 완료” 승인

---

## 8) 알림 기반 협업

사용자가 모든 메시지를 직접 기다리지 않아도, 시스템이 알림으로 흐름을 이어준다. (푸시 채널은 후속; 현재는 **`GET /sessions/:id/timeline`** 과 **`GET /sessions/:id`** 를 주기적으로 호출하는 폴링으로 새 에이전트 발화·게이트 변화를 확인한다.)

- PM 알림: 일정 지연/다음 할 일 제안
- FE 알림: API 계약 불일치 감지
- QA 알림: 검증 실패/수정 필요
- Senior 알림: 리뷰 반영 필요/컨펌 완료

---

## 9) 회고 (MVP 종료)

기능 완료 후 시스템이 회고 리포트를 생성한다.

- 역할 균형
- 재작업률
- 리뷰 반영률
- 커뮤니케이션 품질

마지막으로 다음 스프린트 액션 3개를 제안한다.

---

## 로그인 기능 예시 출력(완료 상태)

- 백엔드: 로그인/회원가입 API 구현 완료
- FE: 계약 기반 호출 가능 상태 확인
- QA: 핵심 시나리오 테스트 통과
- Senior: 리뷰 승인
- PM: 스프린트 목표 달성 처리

## 관련 문서

- [`docs/plan.md`](plan.md)
- [`docs/checklist.md`](checklist.md)
- [`docs/api/collaboration-endpoints-and-env.md`](api/collaboration-endpoints-and-env.md)
- [`docs/backend/agent-event-log.md`](backend/agent-event-log.md)
