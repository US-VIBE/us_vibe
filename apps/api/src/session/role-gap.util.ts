import type { WorkspaceSessionProfile } from "../persistence/workspace-persistence.service";

const ROSTER: Array<{ roleId: string; agentId: string; displayName: string }> = [
  { roleId: "pm", agentId: "agent_pm", displayName: "PM 에이전트" },
  { roleId: "fe", agentId: "agent_fe", displayName: "FE 에이전트" },
  { roleId: "qa", agentId: "agent_qa", displayName: "QA 에이전트" },
  { roleId: "senior", agentId: "agent_senior", displayName: "Senior 에이전트" },
  { roleId: "design", agentId: "agent_design", displayName: "Design 에이전트" },
  { roleId: "coach", agentId: "agent_coach", displayName: "Coach" },
  { roleId: "supervisor", agentId: "agent_supervisor", displayName: "Supervisor" }
];

const HUMAN_LABELS: Record<string, string> = {
  be: "Backend (학습자)",
  pm: "PM",
  fe: "프론트엔드",
  qa: "QA",
  senior: "시니어",
  design: "디자인",
  coach: "코치",
  supervisor: "슈퍼바이저"
};

export function buildRoleGapPayload(sessionId: string, profile: WorkspaceSessionProfile) {
  const human = new Set(profile.humanRoleIds.map((r) => r.toLowerCase().trim()).filter(Boolean));
  const injectedAgents: Array<{
    agentId: string;
    role: string;
    displayName: string;
    mode: "active";
  }> = [];
  const copilotAgents: Array<{
    agentId: string;
    role: string;
    displayName: string;
    mode: "copilot";
  }> = [];

  for (const row of ROSTER) {
    if (human.has(row.roleId)) {
      copilotAgents.push({
        agentId: row.agentId,
        role: row.roleId,
        displayName: row.displayName,
        mode: "copilot"
      });
    } else {
      injectedAgents.push({
        agentId: row.agentId,
        role: row.roleId,
        displayName: row.displayName,
        mode: "active"
      });
    }
  }

  const humanRoleLabels = profile.humanRoleIds.map(
    (id) => HUMAN_LABELS[id.toLowerCase()] ?? id
  );
  const summary =
    injectedAgents.length === 0
      ? "모든 팀 역할에 사람이 배정되어 AI는 코파일럿 모드만 사용합니다."
      : `사람 역할: ${humanRoleLabels.join(", ")}. 결손 역할은 AI 에이전트가 보강합니다.`;

  return {
    sessionId,
    stateVersion: 1,
    humanRoleIds: profile.humanRoleIds,
    humanRoleLabels,
    injectedAgents,
    copilotAgents,
    summary
  };
}
