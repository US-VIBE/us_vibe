import { apiFetch } from "./api-fetch";

export type WorkspaceGates = {
  promptSpecApproved: boolean;
  promptSpecApprovedVersion: number | null;
  contractValidatedPass: boolean;
  contractApproved: boolean;
  prPhase: string;
  prRevisionRound: number;
};

export type ProjectStatePayload = {
  stateVersion: number;
  approvedRequirements: string[];
  currentApiSpecs: string[];
  rejectedDecisions: string[];
  openQuestions: string[];
  activeSprintGoal: string | null;
};

export async function fetchWorkspaceGates(apiBase: string, sessionId: string): Promise<WorkspaceGates> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(
    `${base}/api/sessions/${encodeURIComponent(sessionId)}/workspace-gates`
  );
  if (!res.ok) {
    throw new Error(`workspace-gates ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: WorkspaceGates };
  if (!body?.ok || !body.data) {
    throw new Error("workspace-gates invalid");
  }
  return body.data;
}

export async function patchSessionHumanRoles(
  apiBase: string,
  sessionId: string,
  humanRoleIds: string[]
): Promise<unknown> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(
    `${base}/api/sessions/${encodeURIComponent(sessionId)}/session-profile`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanRoleIds })
    }
  );
  if (!res.ok) {
    throw new Error(`session-profile ${res.status}`);
  }
  return res.json();
}

export async function runWorkspaceDodVerify(
  apiBase: string,
  sessionId: string
): Promise<{
  passed: boolean;
  checks: Array<{ id: string; passed: boolean; detail?: string }>;
  logTail?: string;
}> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(
    `${base}/api/sessions/${encodeURIComponent(sessionId)}/workspace-dod-verify`,
    { method: "POST" }
  );
  if (!res.ok) {
    throw new Error(`workspace-dod-verify ${res.status}`);
  }
  const body = (await res.json()) as {
    ok?: boolean;
    data?: {
      passed: boolean;
      checks: Array<{ id: string; passed: boolean; detail?: string }>;
      logTail?: string;
    };
  };
  const data = body.data;
  if (!body?.ok || !data) {
    throw new Error("dod-verify invalid");
  }
  return data;
}

export async function fetchProjectState(
  apiBase: string,
  sessionId: string
): Promise<ProjectStatePayload> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(
    `${base}/api/sessions/${encodeURIComponent(sessionId)}/project-state`
  );
  if (!res.ok) {
    throw new Error(`project-state ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: ProjectStatePayload };
  if (!body?.ok || !body.data) {
    throw new Error("project-state invalid");
  }
  return body.data;
}
