/**
 * API 없을 때 시나리오 해석 폴백 — 서버 `scenario-registry`와 키워드·기본값을 맞출 것.
 */

export type OfflineResolved = {
  scenarioId: string;
  resolvedBy: "explicit_id" | "keyword" | "default";
  defaults: {
    learningGoal: string;
    sprintDuration: string;
    skillLevel: string;
  };
  checklistMarkdown: string;
};

const LOGIN_KEYWORDS = ["로그인", "login", "auth", "회원", "jwt", "token", "signin", "signup"];

const LOGIN_DEFAULTS = {
  learningGoal: "실무 협업 경험 (시나리오 팩 기본값)",
  sprintDuration: "3일",
  skillLevel: "intermediate"
};

function loginBriefing(topic: string, sessionPlaceholder: string): string {
  return [
    "# 로그인·인증 MVP",
    "",
    `**주제:** ${topic}`,
    "",
    "## 단계",
    "- **킥오프 · 범위 합의** — PM 주도로 목표·범위·일정을 고정합니다.",
    "- **계약 회의 · OpenAPI** — FE·QA 질문을 반영해 specs/openapi 및 api-contract를 확정합니다.",
    "- **구현** — 엔드포인트·에러 포맷·보안 기본을 구현합니다.",
    "- **연동 검증** — GitHub PR 정적 검증·(선택) 프론트 계약 호출을 맞춥니다.",
    "- **회고** — KPI·다음 액션을 정리합니다.",
    "",
    "## 제출·검사",
    "- **OpenAPI 초안** — API 검증 및 저장소 정적 검증.",
    "- **ERD 또는 도메인 스케치** — 워크스페이스 아티팩트 업로드(PNG/JPEG/WebP/PDF).",
    "- **GitHub PR** — ESLint·TypeScript·OpenAPI 검증.",
    "",
    "## GitHub·웹훅 (선택)",
    "```",
    `INTEGRATION_WEBHOOK_SESSION_ID=${sessionPlaceholder}`,
    "```"
  ].join("\n");
}

export function offlineResolveScenario(
  topic: string,
  scenarioId?: string | null,
  webhookSessionId: string = "00000000-0000-4000-8000-000000000000"
): OfflineResolved {
  const t = topic.trim().toLowerCase();
  if (scenarioId?.trim() === "login-mvp") {
    return {
      scenarioId: "login-mvp",
      resolvedBy: "explicit_id",
      defaults: LOGIN_DEFAULTS,
      checklistMarkdown: loginBriefing(topic.trim() || "(주제)", webhookSessionId)
    };
  }
  if (LOGIN_KEYWORDS.some((kw) => t.includes(kw.toLowerCase()))) {
    return {
      scenarioId: "login-mvp",
      resolvedBy: "keyword",
      defaults: LOGIN_DEFAULTS,
      checklistMarkdown: loginBriefing(topic.trim() || "(주제)", webhookSessionId)
    };
  }
  return {
    scenarioId: "login-mvp",
    resolvedBy: "default",
    defaults: LOGIN_DEFAULTS,
    checklistMarkdown: loginBriefing(topic.trim() || "(주제)", webhookSessionId)
  };
}

export function sprintDaysFromDuration(s: string): 1 | 3 | 7 {
  const x = s.toLowerCase();
  if (x.includes("1")) return 1;
  if (x.includes("7")) return 7;
  return 3;
}

export function proficiencyFromSkillLevel(s: string): "beginner" | "intermediate" | "advanced" {
  const x = s.toLowerCase();
  if (x.includes("begin") || x.includes("초급")) return "beginner";
  if (x.includes("adv") || x.includes("고급")) return "advanced";
  return "intermediate";
}
