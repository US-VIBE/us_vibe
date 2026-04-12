import { apiFetch } from "./api-fetch";
import type { IntegrationEventWire } from "./integration-events-api";

/** Postgres `collaboration_events` 행 — OpenAPI `CollaborationEventTimelineItem` */
export type PostgresTimelineEvent = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  sessionId: string | null;
  createdAt: string;
};

export type UnifiedTimelineData = {
  sessionId: string;
  integrationEvents: IntegrationEventWire[];
  postgresTimeline: PostgresTimelineEvent[];
  postgresNote: string | null;
  bridgeHint: string;
};

/** F-2: SQLite·Postgres를 한 목록으로 시간순(최신 우선) 병합 */
export type MergedTimelineRow = {
  source: "sqlite" | "postgres";
  sortMs: number;
  title: string;
  detail: string;
};

export function buildMergedTimelineRows(data: UnifiedTimelineData): MergedTimelineRow[] {
  const rows: MergedTimelineRow[] = [];
  for (const ev of data.integrationEvents) {
    const sortMs = Date.parse(ev.timestamp);
    rows.push({
      source: "sqlite",
      sortMs: Number.isFinite(sortMs) ? sortMs : 0,
      title: ev.type,
      detail: `${ev.timestamp} · v${ev.stateVersion} · ${ev.triggeredBy}`
    });
  }
  for (const row of data.postgresTimeline) {
    const sortMs = Date.parse(row.createdAt);
    rows.push({
      source: "postgres",
      sortMs: Number.isFinite(sortMs) ? sortMs : 0,
      title: row.eventType,
      detail: row.createdAt
    });
  }
  rows.sort((a, b) => b.sortMs - a.sortMs);
  return rows;
}

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
