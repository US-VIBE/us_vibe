/**
 * 스토리1 역할 결손 — 서버 응답 형태 (백엔드 구현 시 동일 스키마 권장)
 * GET /api/sessions/:sessionId/role-gap
 */

export interface InjectedAgent {
  /** 안정적인 에이전트 식별자 (UI·로그용) */
  agentId: string;
  /** 짧은 역할 라벨 (채팅 배지) */
  role: string;
  /** 표시 이름 */
  displayName: string;
}

export interface RoleGapSnapshot {
  sessionId: string;
  stateVersion: number;
  /** 인간 역할 id (예: be) */
  humanRoleIds: string[];
  /** 인간 역할 표시 라벨 */
  humanRoleLabels: string[];
  /** 결손 보강으로 채팅에 참여하는 에이전트 (서버 계산 결과) */
  injectedAgents: InjectedAgent[];
  /** 사람이 맡은 역할과 겹치는 AI — 코파일럿 모드 */
  copilotAgents?: InjectedAgent[];
  /** 한 줄 요약 */
  summary: string;
}
