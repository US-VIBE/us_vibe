# Team Role Charter (4인 고정)

이 문서는 팀원별 담당 범위를 고정하여, 각자 로컬 AI 에이전트가 본인 역할만 수행하도록 하기 위한 단일 기준 문서입니다.

## Team Assignment

- **A. AI 오케스트레이터 (팀장)**: 김성원
- **B. 백엔드 & 데이터 (Core)**: 한승준
- **C. 프론트엔드 & UX**: 유소민
- **D. 인테그레이션 & 샌드박스**: 박준용

## Role Scope (해야 할 일)

### A. 김성원 — AI 오케스트레이터 (팀장)
- LangGraph 워크플로우/상태 전이 설계
- Supervisor 라우팅 규칙, Role Gap Detector 규칙 관리
- 에이전트 프롬프트/정책 버전 관리 (`agents/**`)
- 협업 단계 게이트(Gate A~D) 운영 기준 관리

### B. 한승준 — 백엔드 & 데이터 (Core)
- NestJS API, 도메인 로직, 인증/권한 구조 설계 및 구현
- SSOT 저장소(ProjectState), 로그 저장소(PostgreSQL/Redis) 설계
- OpenAPI 계약 갱신 및 백엔드 기준 계약 정확성 유지
- 데이터 모델/마이그레이션 전략 관리

### C. 유소민 — 프론트엔드 & UX
- Next.js 대시보드, 채팅 UI, Thinking Stream 구현
- API 바인딩 계층(`api-client`)과 상태 UI/에러 UX 관리
- 협업 플로우 화면(요구사항 -> 계약 -> 리뷰 -> 회고) UX 설계
- 접근성/사용성 기준 점검

### D. 박준용 — 인테그레이션 & 샌드박스
- GitHub Webhook/이벤트 연동, 코드 변경 감지 파이프라인
- 정적 검증(Lint/Type/계약 검증) 자동화
- VFS/Shadow Branch 보호 레이어 운영
- CI 흐름 및 외부 도구 연계 안정화

## Out of Scope (역할 침범 금지)

- A는 API/화면 구현 코드를 직접 소유하지 않는다(정책/흐름 중심).
- B는 프론트 화면 UX 결정을 단독 확정하지 않는다.
- C는 백엔드 계약을 임의 변경하지 않는다(계약 변경은 B 승인 필요).
- D는 제품 요구사항/우선순위를 임의 변경하지 않는다.

## Cross-Team Handshake Rules

- 계약 변경: **B 제안 -> C/D 영향도 확인 -> A 승인 라우팅 -> 반영**
- 워크플로우 변경: **A 제안 -> B/C/D 기술 검토 -> 합의 후 반영**
- CI/검증 실패: **D가 원인 분류 -> 해당 오너(B/C/A)에게 조치 요청**

## Local AI Agent Boot Instruction (각자 동일 적용)

각 팀원은 로컬 AI 에이전트 시작 시 아래 지침을 먼저 주입한다.

1. 이 문서(`docs/team-role-charter.md`)를 우선 읽는다.
2. 내 이름과 일치하는 역할 Scope만 수행한다.
3. Out of Scope 항목은 제안만 가능, 직접 변경하지 않는다.
4. 계약 변경/흐름 변경은 Handshake Rules 절차를 따른다.
5. 작업 전/후 `docs/checklist.md` 관련 게이트 상태를 확인한다.

## Deliverable Ownership

- A: `agents/orchestrator/**`, 라우팅/정책 문서
- B: `apps/api/**`, `specs/openapi/**`, `specs/data-model/**`
- C: `apps/web/**`, 프론트 UX 문서
- D: `.github/**`, `scripts/**`, VFS/연동 관련 문서

## Branch & PR Rule

- 모든 작업은 `develop`에서 분기한 `feature/<owner>-<topic>` 브랜치에서 진행한다.
- PR 대상은 항상 `develop`으로 한다.
- PR 설명에는 역할 범위 준수 여부를 체크한다.
