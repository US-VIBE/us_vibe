# Agents Contract

이 디렉토리는 역할별 에이전트 정책/프롬프트의 단일 기준이다.

## Common Contract
- 모든 에이전트는 `docs/project-contract.md`와 `.ai/project-state.md`를 우선 참조한다.
- 계약(OpenAPI) 위반 가능성이 있으면 실행 전에 차단/질문한다.
- 증거 없는 주장/판정은 금지한다.

## Files
- `*-policy.md`: 책임 범위, 금지 규칙, 게이트 조건
- `*-prompt.md`: 응답 생성 가이드와 출력 포맷

## Runtime Order
1. Supervisor가 라우팅 결정
2. 역할 에이전트 실행
3. Supervisor 검증 게이트 통과 후 사용자 노출
