## Summary
- What changed?
- Why does it matter?

## Role Scope Check
<!-- team-role-charter.md 기준 역할 침범 여부 확인 -->
- [ ] 내 역할 범위(Deliverable Ownership) 내 변경만 포함
- [ ] Out of Scope 항목은 제안 형태로만 포함 (직접 변경 없음)

## Checklist
- [ ] API 계약 변경 시 `specs/openapi/v*.yaml` 및 `specs/api-contract.md` 동시 갱신
- [ ] API 계약 변경 시 PR에 `[contract-changed]` 라벨 추가 (B 담당)
- [ ] 관련 Gate 체크리스트(`docs/checklist.md`) 상태 업데이트
- [ ] CI (lint / typecheck / contract-validation / build) 통과 확인

## Related Gate
<!-- 해당하는 항목 체크 -->
- [ ] Gate A: 요구사항 변경
- [ ] Gate B: API 계약 변경
- [ ] Gate C: 구현/리뷰
- [ ] Gate D: 회고/평가
