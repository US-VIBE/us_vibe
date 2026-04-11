# FE / BE 핸드오프: 협업·연동 권장 사양

**목적:** B·C가 각자 브랜치에서 구현할 때 참고할 **티켓 후보·권장안**. 계약·스키마 변경은 B 주도·[team-role-charter.md](team-role-charter.md)·[checklist.md](checklist.md)를 따른다.

**상위 백로그:** [vision-product-backlog.md](vision-product-backlog.md) §3 (F-1 … F-6).

---

## 세션 ID ↔ Postgres 시뮬 ↔ 웹훅

- **권장:** 온보딩 또는 별도 플로우에서 `POST /sessions` 응답 `id`를 학습 `sessionId`로 쓰거나, 시뮬 UUID **붙여넣기** 후 세션 생성.
- **운영:** `INTEGRATION_WEBHOOK_SESSION_ID`를 동일 UUID로 — [collaboration-env-and-endpoints.md](collaboration-env-and-endpoints.md) §3.1, [session-id-sync.md](integration-sandbox/session-id-sync.md).

---

## 통합 타임라인

- API는 SQLite·Postgres 배열 분리 제공.
- **권장 FE:** 소스별 탭 + 선택적 **시간 병합** 뷰(`timestamp` / `createdAt` 파싱, 출처 배지).

---

## 워크스페이스 DoD vs 시뮬 verify

- DoD는 SQLite·스크립트 점검; 시뮬 **B→C**는 `POST /sessions/:id/verify`가 공식 경로 — [fe-web-integration.md](fe-web-integration.md) §7.2.
- **권장:** 한 버튼 자동 연쇄보다 **두 액션 분리** 노출(제품이 합의하면 이 문서·백로그 갱신).

---

## PR 검증

- 검증 API 입력의 **하드코딩 PR 번호 제거**; 스토리3 스냅샷 `prNumber`로 시드.

---

## 계약 승인

- 서버는 HTTP 200이어도 본문 `ok: false` 가능(`PROMPT_SPEC_NOT_APPROVED`, `CONTRACT_INVALID` 등).
- **권장 FE:** JSON `ok === false` 처리, Prompt-to-Spec 승인 전 승인 버튼 비활성(서버와 동일 조건).

---

## 회고 KPI

- **권장 BE:** 신규 리포트에 선택 필드 `kpiBasis`(한 줄)로 이벤트 타입 근거 문구 저장.
- **권장 FE:** 스토리5에 한 줄 표시; 구 리포트는 폴백 문구.

---

## 티켓으로 옮길 때

각 항목을 GitHub/Jira 티켓으로 만들 때 [vision-product-backlog.md](vision-product-backlog.md)의 **F-1 … F-6** ID를 본문에 인용하면 추적이 쉽다.
