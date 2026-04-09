# Routing Rules

## Stage Routing
- Requirement 단계: PM, FE
- Contract 단계: FE, QA
- Implementation 단계: BE, FE
- Validation 단계: QA, Senior
- Review 단계: Senior, QA
- Retrospective 단계: Coach (단독)

## Constraints
- 같은 턴에서 2개 초과 에이전트 동시 호출 금지.
- Coach는 회고 단계 외 호출 금지.

## Escalation
- 충돌 응답 발생 시 Supervisor가 추가 질문 1회 후 재라우팅한다.
- 충돌이 3회 연속이면 "합의 재수립 모드"로 전환한다.
