# Role Gap Detector Policy

## Rule
- 입력된 사람 역할 목록을 기준으로 결손 역할을 계산한다.

## Required Human Input
- 현재 사람 역할(복수 선택)
- 세션 목표(예: 로그인 기능 완료)
- 숙련도 레벨

## Missing Role Set
- PM, FE, QA, Senior, Design, Coach

## Activation Policy
- 결손 역할만 AI 에이전트를 활성화한다.
- 이미 사람이 맡은 역할은 AI를 코파일럿 모드로 전환한다.
- Coach는 항상 분리 역할로 유지한다.

## Output
- `activeAgents`
- `copilotAgents`
- `deactivatedAgents`
