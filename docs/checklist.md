# Stage Checklist

## Gate A: Requirement
- [ ] 요구사항 확정
- [ ] 범위/우선순위 합의

## Gate B: API Contract
- [ ] OpenAPI v1 승인
- [ ] FE/QA 계약 검증 통과
- [ ] `specs/api-contract.md` 엔드포인트 목록이 `specs/openapi/v1.yaml`과 일치 (`npm run` 루트 스크립트의 contract-validation / `node scripts/validate-api-contract.js`)
- [ ] OpenAPI 경로·요청/응답 스키마·`api-contract.md` 응답 정책이 바뀐 경우: GitHub PR에 **`[contract-changed]`** 라벨 추가 (**B 담당**, 팀 규칙 [`team-role-charter.md`](team-role-charter.md))

## Gate C: Review
- [ ] PR 코멘트 반영
- [ ] 재검토 승인

## Gate D: Retrospective
- [ ] KPI 리포트 확인
- [ ] 다음 액션 3개 확정

---

## GitHub PR · 계약 라벨 (운영)

| 규칙 | 내용 |
|------|------|
| `[contract-changed]` | `specs/openapi/v*.yaml` 또는 `specs/api-contract.md`에 **엔드포인트 추가/삭제·스키마 의미 변경**이 있으면 PR에 부착. **박준용(B)** 가 머지 전 확인·또는 대리자 합의 하에 부착. |
| 검증 | 루트에서 `node scripts/validate-api-contract.js` 통과를 CI 또는 로컬로 확인. |
| 문서만 변경 | 오타·내부 링크만 고친 경우 라벨 생략 가능(리뷰어 판단). |
