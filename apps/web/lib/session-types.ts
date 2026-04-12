/** 온보딩 입력 → 세션 (docs/user-scenario-be-solo-mvp.md §1) */

export type Proficiency = "beginner" | "intermediate" | "advanced";

/** 채팅·협업 톤: 학습자가 맡는 구현 축 */
export type LearnerRole = "backend_developer" | "frontend_developer";

/** API·프롬프트용: 학습자 집중 축 */
export function learnerFocusFromRole(role: LearnerRole | undefined): "backend" | "frontend" {
  return role === "frontend_developer" ? "frontend" : "backend";
}

export interface LearningSession {
  sessionId: string;
  /** 학습자가 맡는 구현 축 — 에이전트는 여기에 맞춰 ‘결손 보강’한다 */
  learnerRole: LearnerRole;
  goal: string;
  topic: string;
  /** 시나리오 팩 id (예: login-mvp) */
  scenarioId?: string;
  /** 온보딩 시 서버·오프라인 해석으로 채운 브리핑 Markdown */
  briefingMarkdown?: string;
  sprintDays: 1 | 3 | 7;
  proficiency: Proficiency;
  /** §1 활성화 AI 역할군 */
  activatedAiRoleLabels: readonly string[];
  createdAt: string;
}

export const SOLO_BE_ACTIVATED_AI_ROLES = [
  "PM",
  "FE",
  "QA",
  "Senior",
  "Supervisor",
  "Coach"
] as const;
