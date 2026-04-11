import { apiFetch } from "./api-fetch";
import type { LearningSession } from "./session-types";
import type { InjectedAgent, RoleGapSnapshot } from "./role-gap-types";

function mockSoloBeSnapshot(session: LearningSession): RoleGapSnapshot {
  return {
    sessionId: session.sessionId,
    stateVersion: 1,
    humanRoleIds: ["be"],
    humanRoleLabels: ["Backend Developer (학습자)"],
    injectedAgents: [
      { agentId: "agent_pm", role: "PM", displayName: "PM 에이전트" },
      { agentId: "agent_fe", role: "FE", displayName: "FE 에이전트" },
      { agentId: "agent_qa", role: "QA", displayName: "QA 에이전트" },
      { agentId: "agent_senior", role: "Senior", displayName: "Senior 에이전트" },
      { agentId: "agent_supervisor", role: "Supervisor", displayName: "Supervisor" },
      { agentId: "agent_coach", role: "Coach", displayName: "Coach" }
    ],
    summary:
      "백엔드 단독 팀: PM·FE·QA·Senior·Supervisor·Coach 에이전트가 결손을 보강해 채팅에 참여합니다."
  };
}

function parseInjectedAgents(raw: unknown): InjectedAgent[] {
  if (!Array.isArray(raw)) return [];
  const out: InjectedAgent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    if (
      typeof a.agentId === "string" &&
      typeof a.role === "string" &&
      typeof a.displayName === "string"
    ) {
      out.push({ agentId: a.agentId, role: a.role, displayName: a.displayName });
    }
  }
  return out;
}

function parseSnapshot(body: unknown): RoleGapSnapshot | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const data = (o.data as Record<string, unknown> | undefined) ?? o;
  if (typeof data.sessionId !== "string") return null;
  const agents = parseInjectedAgents(data.injectedAgents);
  const copilots = parseInjectedAgents(data.copilotAgents);
  return {
    sessionId: data.sessionId,
    stateVersion: typeof data.stateVersion === "number" ? data.stateVersion : 1,
    humanRoleIds: Array.isArray(data.humanRoleIds) ? (data.humanRoleIds as string[]) : [],
    humanRoleLabels: Array.isArray(data.humanRoleLabels) ? (data.humanRoleLabels as string[]) : [],
    injectedAgents: agents,
    copilotAgents: copilots.length ? copilots : undefined,
    summary: typeof data.summary === "string" ? data.summary : ""
  };
}

/**
 * 역할 결손 스냅샷 조회.
 * `NEXT_PUBLIC_API_URL`이 있으면 GET `/api/sessions/:id/role-gap` 시도 후 실패 시 목업.
 */
export async function fetchRoleGapSnapshot(session: LearningSession): Promise<RoleGapSnapshot> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) {
    try {
      const res = await apiFetch(`${base}/api/sessions/${encodeURIComponent(session.sessionId)}/role-gap`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      if (res.ok) {
        const json: unknown = await res.json();
        const nested =
          json && typeof json === "object" && "data" in json
            ? (json as { data: unknown }).data
            : json;
        const parsed = parseSnapshot(nested);
        if (parsed) return parsed;
      }
    } catch (e) {
      console.warn("[role-gap] API 호출 실패, 목업 사용", e);
    }
  }
  return mockSoloBeSnapshot(session);
}
