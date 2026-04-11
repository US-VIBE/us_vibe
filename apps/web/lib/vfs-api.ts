import { apiFetch } from "./api-fetch";

export type VfsDiffPayload = {
  snapshotId: string;
  status: string;
  agentType: string;
  createdAt: string;
  files: Array<{ filePath: string; content: string; lineCount: number }>;
};

export function resolveVfsDiffUrl(apiBase: string, diffPath: string): string {
  const base = apiBase.replace(/\/$/, "");
  if (diffPath.startsWith("http")) {
    return diffPath;
  }
  return `${base}${diffPath.startsWith("/") ? "" : "/"}${diffPath}`;
}

export async function createVfsSnapshot(
  apiBase: string,
  sessionId: string,
  agentType: string,
  files: Array<{ filePath: string; content: string }>
): Promise<{ snapshotId: string; diffUrl: string }> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(`${base}/api/vfs/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, agentType, files })
  });
  if (!res.ok) {
    throw new Error(`vfs snapshot ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: { snapshotId: string; diffUrl: string } };
  if (!body?.ok || !body.data) {
    throw new Error("vfs snapshot invalid response");
  }
  return body.data;
}

export async function fetchVfsDiff(apiBase: string, snapshotId: string): Promise<VfsDiffPayload> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(`${base}/api/vfs/diff/${encodeURIComponent(snapshotId)}`);
  if (!res.ok) {
    throw new Error(`vfs diff ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: VfsDiffPayload };
  if (!body?.ok || !body.data) {
    throw new Error("vfs diff invalid response");
  }
  return body.data;
}

export async function approveVfsSnapshot(apiBase: string, snapshotId: string): Promise<unknown> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(`${base}/api/vfs/approve/${encodeURIComponent(snapshotId)}`, {
    method: "POST"
  });
  if (!res.ok) {
    throw new Error(`vfs approve ${res.status}`);
  }
  return res.json();
}
