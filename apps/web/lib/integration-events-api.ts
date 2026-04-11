import { apiFetch } from "./api-fetch";

export type IntegrationEventWire = {
  type: string;
  sessionId: string;
  stateVersion: number;
  triggeredBy: string;
  payload: Record<string, unknown>;
  timestamp: string;
};

export async function fetchIntegrationEvents(
  apiBase: string,
  sessionId: string,
  limit: number
): Promise<IntegrationEventWire[]> {
  const q = new URLSearchParams();
  if (sessionId.trim()) {
    q.set("sessionId", sessionId.trim());
  }
  q.set("limit", String(limit));
  const res = await apiFetch(`${apiBase.replace(/\/$/, "")}/api/integration/events?${q.toString()}`);
  if (!res.ok) {
    throw new Error(`integration events ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: { events?: IntegrationEventWire[] } };
  if (!body?.ok || !Array.isArray(body.data?.events)) {
    return [];
  }
  return body.data.events;
}
