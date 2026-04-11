# Stage Checklist

## Gate A: Requirement
- [ ] 요구사항 확정
- [ ] 범위/우선순위 합의

## Gate B: API Contract
- [ ] OpenAPI v1 승인
- [ ] FE/QA 계약 검증 통과
- [ ] `specs/api-contract.md` 엔드포인트 목록이 `specs/openapi/v1.yaml`과 일치 (`npm run` 루트 스크립트의 contract-validation / `node scripts/validate-api-contract.js`)

## Gate C: Review
- [ ] PR 코멘트 반영
- [ ] 재검토 승인

## Gate D: Retrospective
- [ ] KPI 리포트 확인
- [ ] 다음 액션 3개 확정
