# 시나리오 팩 (Scenario pack)

워크스페이스·`POST /sessions`가 **주제(및 선택적 `scenarioId`)**만 받을 때, 나머지 학습 컨텍스트·산출물·검사 방식은 **시나리오 팩**에서 채운다.

## 필드 (스키마 요약)

| 필드 | 설명 |
|------|------|
| `id` | 팩 식별자 (예: `login-mvp`) |
| `version` | semver 또는 정수 |
| `matchKeywords` | 주제 문자열에 포함되면 이 팩 후보 (소문자 비교) |
| `defaults` | `learningGoal`, `sprintDuration`, `skillLevel`, `activeRoles` |
| `phases` | 사용자에게 보이는 단계 라벨·설명 |
| `deliverables` | 제출 항목·형식·검사 방법 |
| `evaluation` | 루브릭 요약·자동 검사 훅 이름 |
| `githubHints` | 웹훅·환경 변수 안내용 템플릿 (플레이스홀더 `{{sessionId}}`) |
| `prValidationFixGuide` | 정적 검증 실패 시 PR/타임라인에 붙일 수정 요청 안내 (Markdown) |

구현 SSOT: [`../../apps/api/src/scenarios/packs/login-mvp.pack.ts`](../../apps/api/src/scenarios/packs/login-mvp.pack.ts) (런타임 로드). 이 README는 계약 설명용이다.
