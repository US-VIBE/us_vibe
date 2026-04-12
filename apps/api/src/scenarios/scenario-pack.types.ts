/** 시나리오 팩 — 주제 외 컨텍스트·산출물·검사 안내의 SSOT */

export interface ScenarioPhase {
  id: string;
  title: string;
  description: string;
}

export interface ScenarioDeliverable {
  id: string;
  title: string;
  format: string;
  howYouWillBeEvaluated: string;
}

export interface ScenarioDefaults {
  learningGoal: string;
  sprintDuration: string;
  skillLevel: string;
  activeRoles: string[];
}

export interface ScenarioPack {
  id: string;
  version: string;
  title: string;
  summary: string;
  /** 소문자 주제에 부분 문자열로 매칭 */
  matchKeywords: string[];
  defaults: ScenarioDefaults;
  phases: ScenarioPhase[];
  deliverables: ScenarioDeliverable[];
  evaluationSummary: string;
  /** `{{sessionId}}` 치환 */
  githubEnvSnippetTemplate: string;
  /** PR 정적 검증 실패 시 코멘트 상단에 붙는 학습자 안내 */
  prValidationFixGuide: string;
}

export interface ResolvedScenario {
  pack: ScenarioPack;
  resolvedBy: "explicit_id" | "keyword" | "default";
}
