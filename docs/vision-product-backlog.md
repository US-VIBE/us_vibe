# 비전 대비 제품 백로그 (역할·우선순위)

팀 [역할 헌장](team-role-charter.md): **A** AI 오케스트레이터, **B** 백엔드·데이터, **C** 프론트·UX, **D** 인테그레이션·샌드박스.

**최종 목표**는 좁은 MVP 완주가 아니라 [AI 협업 에이전트 설계](ai_협업_에이전트_설계_10198352.plan.md)에 기술된 **제품·AI 협업 비전 전체**이다. [plan.md](plan.md)의 MVP·V2는 **단계 마일스톤**으로만 본다.

워크 방식: [살아 있는 설계 역반영](design-living-revisions.md). 역할 D 파이프라인 변경 시: [D 주도 구현·FE/BE 맞춤](integration-sandbox/d-owner-workflow-fe-be-handoff.md).

---

## 에픽·스프린트 묶음 (우선순위 제안)

| 묶음 | 우선순위 | 주 담당 | 한 줄 |
|------|----------|---------|--------|
| E1 오케스트레이션 런타임 | P0 | A, B | 세션 상태머신·에이전트 턴을 정책/REST와 연결 |
| E2 SSOT·코델타·이벤트 | P0 | B, D | `ProjectState`·웹훅·통합 이벤트 파이프 정합 |
| E3 연동·워크스페이스 UX | P1 | B, C, D | 세션 ID·타임라인·DoD/verify·PR·계약·KPI |
| E4 보안·멀티유저 | P1 | B, D | `sessionId`·계정, 웹훅 하드닝 |
| E5 파이프라인 고도화 | P2 | D | Redis 재시도·웹훅 비동기 큐 |
| E6 비전 확장(V2급) | P2 | A, C | 음성·로컬 동기·E2E 등 [plan.md](plan.md) Out of Scope |

스프린트 배치는 팀 용량에 맞게 E1→E2→E3 순 권장; E4는 E3과 병행 가능.

---

## 1. AI 오케스트레이션·평가 (비전 핵심)

| ID | 백로그 항목 | 담당 | 비고 |
|----|-------------|------|------|
| O-1 | 세션 오케스트레이터·상태머신과 REST·정책 MD·런타임(LangGraph/Supervisor 등) 연결 | A, B | 호출 경로·세션 키·실패 시나리오 스펙 분리 |
| O-2 | Role Gap 규칙·에이전트 프롬프트·금지 정책을 구현·버전 관리 가능 수준으로 고정 | A | `agents/**`와 설계서 동기화 |
| O-3 | 학습·협업 KPI·회고를 오케스트레이터·이벤트 로그와 일관되게 묶기 | A, B | [retro-kpi.util.ts](../apps/api/src/session/retro-kpi.util.ts)와 정합 |
| O-4 | `codeDeltaSummary` → `ProjectState` 필드·웹훅 파이프·쓰기 시점 정의 | B, D | SQLite `ProjectState` 병합·push 웹훅 (2026-04-10). Postgres SSOT·A 갱신은 후속 |
| O-5 | 영향도 리포트·PM 스케줄러·샌드박스 미리보기 — MVP/V2 경계 재검토 후 티켓화 | A, B, D | 설계 본문 백로그로 쪼개기 |

---

## 2. 제품 로드맵 확장 (비전에 포함되는 V2급)

[plan.md](plan.md) Out of Scope — 비전 달성 시 포함 후보:

| ID | 항목 | 담당 |
|----|------|------|
| V-1 | 음성 회의 | A, C |
| V-2 | 완전 자동 로컬 파일 동기화 | D, B |
| V-3 | 동적 E2E(Playwright) 중심 검증 | D, QA 협의 |

설계서 다른 절과 충돌 시 **설계서를 우선**하고 [design-living-revisions.md](design-living-revisions.md)로 반영한다.

---

## 3. FE / BE 연동·워크스페이스 UX (B/C 큐)

상세 권장 사양·티켓 후보: [handoff-fe-be-collaboration-recommendations.md](handoff-fe-be-collaboration-recommendations.md).

| ID | 항목 | 담당 | 문서 근거 |
|----|------|------|-----------|
| F-1 | 세션 ID: 시뮬 `POST /sessions`·학습 `sessionId`·웹훅 env 정렬 | B, C, D | [session-id-sync.md](integration-sandbox/session-id-sync.md) |
| F-2 | 통합 타임라인: 탭 외 병합 뷰·정렬·접근성 | C | [fe-web-integration.md](fe-web-integration.md) |
| F-3 | DoD vs 시뮬 verify UX·복합 시나리오 | B, C | [fe-web-integration.md](fe-web-integration.md) §7.2 |
| F-4 | PR 검증·스냅샷 `prNumber` 연동, 하드코딩 제거 | C | 스토리3·연동 패널 |
| F-5 | 계약 승인: `ok: false` 본문·게이트와 FE 정합 | B, C | [contract-gate.controller.ts](../apps/api/src/session/contract-gate.controller.ts) |
| F-6 | 회고 KPI 산출 근거 리포트·화면 스펙 | B, C | [retro-kpi.util.ts](../apps/api/src/session/retro-kpi.util.ts) |

---

## 4. 데이터·보안·멀티유저

| ID | 항목 | 담당 |
|----|------|------|
| S-1 | 학습 `sessionId`와 계정·테넌시 강결합 | B |
| S-2 | 웹훅 서명·남용 방지·운영 하드닝 (`GITHUB_WEBHOOK_REQUIRE_SIGNATURE`, IP 허용 목록 `WEBHOOK_ALLOWLIST`, 2026-04-10~) | D, B |

근거: [fe-web-integration.md](fe-web-integration.md) §7.

---

## 5. 인테그레이션·파이프라인 고도화

| ID | 항목 | 담당 |
|----|------|------|
| P-1 | Redis Pub/Sub 실패 재시도·큐(예: BullMQ) — Pub/Sub: 동일 프로세스 재시도(2026-04-10); **PR 검증 영속 큐: `INTEGRATION_BULLMQ`(2026-04-10)** | D |
| P-2 | 웹훅 정적 검증 비동기 큐·타임아웃 정책 — 인메모리 또는 **`INTEGRATION_BULLMQ`+Redis**(2026-04-10) | D |

근거: [d-integration-pipeline.md](integration-sandbox/d-integration-pipeline.md).

---

## 6. 프로세스·게이트

| ID | 항목 | 담당 |
|----|------|------|
| G-1 | Gate A~D·[`checklist.md`](checklist.md) 운영 | 전원 |
| G-2 | API 계약 변경 시 `[contract-changed]`·OpenAPI·api-contract 동기 | B |
| G-3 | 핸드오프·연동 문서를 비전 진행에 맞춰 갱신 | D, C |

---

## 관련 문서

- [AI 협업 에이전트 설계](ai_협업_에이전트_설계_10198352.plan.md)
- [FE/BE 협업 권장 사양](handoff-fe-be-collaboration-recommendations.md)
- [살아 있는 설계 역반영 절차](design-living-revisions.md)
