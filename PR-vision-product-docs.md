# PR: 비전 백로그·살아 있는 설계·FE/BE 핸드오프 문서

`feature/hanseungjun-d-integration-next` → `develop`

Made-with: Cursor

---

## Summary

### What changed?

- **[`docs/vision-product-backlog.md`](docs/vision-product-backlog.md)** — 설계서 전체 비전 대비 **에픽(E1–E6)**·우선순위(P0–P2)·역할 태그(A/B/C/D)·백로그 ID(**O** 오케스트레이션, **F** FE/BE 연동, **S** 보안·멀티유저, **P** 파이프라인, **G** 게이트).
- **[`docs/design-living-revisions.md`](docs/design-living-revisions.md)** — 구현·파일럿 이후 **설계·연동 문서 역반영** 절차(언제/어디/주기·Gate 정렬).
- **[`docs/handoff-fe-be-collaboration-recommendations.md`](docs/handoff-fe-be-collaboration-recommendations.md)** — B/C가 티켓으로 옮길 **연동·UX 권장 사양**(세션 ID, 타임라인, DoD/verify, PR, 계약, KPI).
- **[`docs/plan.md`](docs/plan.md)** — “제품 비전 vs 이 문서의 위치” 절 추가(MVP는 마일스톤, 최종은 설계 비전).
- **[`docs/fe-web-integration.md`](docs/fe-web-integration.md)** §8 — 위 문서로의 링크.
- **[`docs/integration-sandbox/README.md`](docs/integration-sandbox/README.md)** — 동일 링크 행 추가.

### Why does it matter?

- **최종 목표**를 설계서 비전과 정렬하고, MVP 문서와의 관계를 한곳에서 읽을 수 있다.
- FE/BE/인테그레이션이 **같은 ID(F-1 …)** 로 백로그를 말할 수 있고, 구현 후 **문서 먼저** 갱신하는 팀 규칙을 명문화한다.
- 코드 충돌 없이 **문서만** 머지해 역할별 작업 분리가 쉬워진다.

---

## Role Scope Check

<!-- [`docs/team-role-charter.md`](docs/team-role-charter.md) 기준 역할 침범 여부 확인 -->

- [ ] 내 역할 범위(Deliverable Ownership) 내 변경만 포함
- [ ] Out of Scope 항목은 제안 형태로만 포함 (직접 변경 없음)

**참고:** 본 PR은 **문서만** 수정한다. 다만 `vision-product-backlog`·`plan`은 제품·비전·우선순위를 서술하므로, 작성자는 **D(인테그·문서) / A(비전·게이트) / PM 합의** 범위에서 기여했는지 확인하고 위 항목을 체크해 주세요.

---

## Checklist

- [x] API 계약 변경 시 `specs/openapi/v*.yaml` 및 `specs/api-contract.md` 동시 갱신 — **해당 없음(본 PR은 문서만)**
- [ ] API 계약 변경 시 PR에 `[contract-changed]` 라벨 추가 (B 담당) — **해당 없음**
- [ ] 관련 Gate 체크리스트(`docs/checklist.md`) 상태 업데이트 — 필요 시 별도 PR 또는 본 PR 후속으로 반영
- [ ] CI (lint / typecheck / contract-validation / build) 통과 확인 — 문서만 변경이나 머지 전 파이프라인에서 재확인 권장

---

## Related Gate

<!-- 해당하는 항목 체크 -->

- [x] Gate A: 요구사항 변경 — 비전·MVP 관계·백로그 우선순위를 문서로 명확화
- [ ] Gate B: API 계약 변경
- [ ] Gate C: 구현/리뷰
- [ ] Gate D: 회고/평가

---

## 커밋

- `docs: 비전 백로그·살아 있는 설계·FE/BE 핸드오프 문서 추가` (`f6ffc86` 기준, 이후 추가 커밋이 있으면 PR에서 갱신)
