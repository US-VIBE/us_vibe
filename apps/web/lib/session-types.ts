/** 온보딩 입력 → 세션 (docs/user-scenario-be-solo-mvp.md §1) */

export type Proficiency = "beginner" | "intermediate" | "advanced";

export interface LearningSession {
  sessionId: string;
  /** 문서: 학습자 역할은 Backend Developer 고정 */
  learnerRole: "backend_developer";
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
