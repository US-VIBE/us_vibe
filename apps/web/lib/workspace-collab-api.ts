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

export type IntegrationHints = {
  integrationWebhookSessionId: string;
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
