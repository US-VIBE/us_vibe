import type { ScenarioPack } from "../scenario-pack.types";

export const LOGIN_MVP_PACK: ScenarioPack = {
  id: "login-mvp",
  version: "1.0.0",
  title: "로그인·인증 MVP",
  summary:
    "백엔드 학습자가 PM·FE와 계약을 맞추고, OpenAPI·구현·PR 검증까지 실무형으로 진행합니다.",
  matchKeywords: ["로그인", "login", "auth", "회원", "jwt", "token", "signin", "signup"],
  defaults: {
    learningGoal: "실무 협업 경험 (시나리오 팩 기본값)",
    sprintDuration: "3일",
    skillLevel: "intermediate",
    activeRoles: ["PM", "FE", "QA", "Senior", "Supervisor", "Coach"]
  },
  phases: [
    {
      id: "kickoff",
      title: "킥오프 · 범위 합의",
      description: "PM 주도로 목표·범위·일정을 고정합니다."
    },
    {
      id: "contract",
      title: "계약 회의 · OpenAPI",
      description: "FE·QA 질문을 반영해 specs/openapi 및 api-contract를 확정합니다."
    },
    {
      id: "implement",
      title: "구현",
      description: "엔드포인트·에러 포맷·보안 기본을 구현합니다."
    },
    {
      id: "integrate",
      title: "연동 검증",
      description: "GitHub PR 정적 검증·(선택) 프론트 계약 호출을 맞춥니다."
    },
    {
      id: "retro",
      title: "회고",
      description: "KPI·다음 액션을 정리합니다."
    }
  ],
  deliverables: [
    {
      id: "openapi",
      title: "OpenAPI 초안",
      format: "YAML (`specs/openapi/v1.yaml` 정본과 정합)",
      howYouWillBeEvaluated: "API `POST .../contract/validate` 및 저장소 정적 검증(contract diff)."
    },
    {
      id: "erd",
      title: "ERD 또는 도메인 스케치",
      format: "PNG/JPEG/PDF, 워크스페이스 아티팩트 업로드",
      howYouWillBeEvaluated: "파일 수신·크기·형식 체크리스트 통과(및 선택 LLM 코멘트)."
    },
    {
      id: "github_pr",
      title: "GitHub PR",
      format: "feature 브랜치 → develop 등 팀 규칙",
      howYouWillBeEvaluated: "ESLint·TypeScript·OpenAPI 정적 검증. 실패 시 수정 요청 템플릿이 PR·타임라인에 기록됩니다."
    }
  ],
  evaluationSummary:
    "게이트 A→B→C는 시뮬 세션 규칙을 따릅니다. 구현 완료 후 `implementation-ready` → `verify`로 계약 파일 존재를 검사합니다. GitHub 연동 시 웹훅으로 PR마다 정적 검증이 돌고, 실패하면 아래 안내가 코멘트에 포함됩니다.",
  githubEnvSnippetTemplate: `# 이 학습 세션 UUID를 웹훅·타임라인과 맞춥니다.
INTEGRATION_WEBHOOK_SESSION_ID={{sessionId}}
# GitHub 웹훅 대상 (예시)
# POST http://<호스트>:4000/webhooks/github
`,
  prValidationFixGuide: `## 학습자 수정 가이드 (시나리오: login-mvp)

1. **ESLint / TypeScript** 오류를 로컬에서 재현한 뒤, 동일 브랜치에 커밋을 쌓고 PR을 업데이트하세요.
2. **OpenAPI 계약**이 바뀌었다면 FE 관점 필드·에러 코드를 반영하고 \`specs/api-contract.md\`와 본문을 맞추세요.
3. **연속 실패 5회** 시 검증이 스킵될 수 있으니, 루프를 끊기 위해 한 번에 한 가지 원인부터 고치세요.
4. 질문이 있으면 워크스페이스 채널에서 **FE 역할**에 계약 질문을 남기는 것을 권장합니다.
`
};
