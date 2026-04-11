import { apiFetch } from "./api-fetch";
import type { IntegrationEventWire } from "./integration-events-api";

export type UnifiedTimelineData = {
  sessionId: string;
  integrationEvents: IntegrationEventWire[];
  postgresTimeline: unknown[];
  postgresNote: string | null;
  bridgeHint: string;
};

export async function fetchUnifiedTimeline(
  apiBase: string,
  sessionId: string,
  limit: number
): Promise<UnifiedTimelineData> {
  const base = apiBase.replace(/\/$/, "");
  const q = new URLSearchParams({ sessionId, limit: String(limit) });
  const res = await apiFetch(`${base}/api/integration/unified-timeline?${q}`);
  if (!res.ok) {
    throw new Error(`unified-timeline ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: UnifiedTimelineData };
  if (!body?.ok || !body.data) {
    throw new Error("unified-timeline invalid body");
  }
  return body.data;
}
