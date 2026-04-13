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

/** 시뮬 Postgres 세션 Gate C — `POST /sessions/:id/verify` (JWT 불필요, 워크스페이스 DoD와 별도). */
export async function runSimulationSessionVerify(
  apiBase: string,
  sessionId: string
): Promise<{ ok: true; summary: string } | { ok: false; message: string }> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(`${base}/sessions/${encodeURIComponent(sessionId)}/verify`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  if (res.ok) {
    const text = await res.text();
    const summary =
      text.length > 400 ? `${text.slice(0, 400)}…` : text || `HTTP ${res.status} (본문 없음)`;
    return { ok: true, summary };
  }
  let message = `verify ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string; code?: string };
    if (typeof j?.message === "string") {
      message = j.message;
    } else if (typeof j?.code === "string") {
      message = j.code;
    }
  } catch {
    /* ignore */
  }
  return { ok: false, message };
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

export type IntegrationHints = {
  integrationWebhookSessionId: string;
  /** API 서버 .env 한 줄 — Railway 등에 붙여넣기 */
  recommendedServerEnvLine: string;
  bffSyncNote: string;
  /** 워크스페이스 없이 Postgres 시뮬만 쓸 때의 웹 경로 */
  simulateOnlyPath: string;
  envSnippet: string;
  docPath: string;
  note: string;
};

export async function fetchIntegrationHints(
  apiBase: string,
  sessionId: string
): Promise<IntegrationHints> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(
    `${base}/api/sessions/${encodeURIComponent(sessionId)}/integration-hints`
  );
  if (!res.ok) {
    throw new Error(`integration-hints ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: IntegrationHints };
  if (!body?.ok || !body.data) {
    throw new Error("integration-hints invalid");
  }
  return body.data;
}

export async function uploadWorkspaceArtifact(
  apiBase: string,
  sessionId: string,
  file: File,
  kind?: string
): Promise<unknown> {
  const base = apiBase.replace(/\/$/, "");
  const fd = new FormData();
  fd.append("file", file);
  if (kind) {
    fd.append("kind", kind);
  }
  const res = await apiFetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/artifacts`, {
    method: "POST",
    body: fd
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(errBody.message ?? `artifacts ${res.status}`);
  }
  return res.json();
}

export async function fetchInAppNotifications(
  apiBase: string,
  sessionId: string
): Promise<Array<{ id: string; title: string; body: string; kind: string; createdAt: string }>> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(
    `${base}/api/sessions/${encodeURIComponent(sessionId)}/in-app-notifications`
  );
  if (!res.ok) {
    throw new Error(`in-app-notifications ${res.status}`);
  }
  const body = (await res.json()) as {
    ok?: boolean;
    data?: Array<{ id: string; title: string; body: string; kind: string; createdAt: string }>;
  };
  if (!body?.ok || !Array.isArray(body.data)) {
    throw new Error("in-app-notifications invalid");
  }
  return body.data;
}

export async function patchProjectState(
  apiBase: string,
  sessionId: string,
  patch: {
    expectedVersion?: number;
    activeSprintGoal?: string | null;
    approvedRequirements?: string[];
    currentApiSpecs?: string[];
    rejectedDecisions?: string[];
    openQuestions?: string[];
  }
): Promise<ProjectStatePayload> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(
    `${base}/api/sessions/${encodeURIComponent(sessionId)}/project-state`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }
  );
  const body = (await res.json()) as {
    ok?: boolean;
    data?: ProjectStatePayload;
    code?: string;
    message?: string;
  };
  if (!res.ok || !body?.ok) {
    const msg = body?.message ?? body?.code ?? `project-state PATCH ${res.status}`;
    throw new Error(msg);
  }
  if (!body.data) {
    throw new Error("project-state PATCH invalid");
  }
  return body.data;
}
