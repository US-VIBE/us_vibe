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
  /** 리스트 키·접근성용 */
  stableKey: string;
  /** `<time datetime>` — 파싱 실패 시 빈 문자열 */
  isoTime: string;
};

function toIsoOrEmpty(isoLike: string): string {
  const ms = Date.parse(isoLike);
  if (!Number.isFinite(ms)) {
    return "";
  }
  try {
    return new Date(ms).toISOString();
  } catch {
    return "";
  }
}

export function buildMergedTimelineRows(data: UnifiedTimelineData): MergedTimelineRow[] {
  const rows: MergedTimelineRow[] = [];
  data.integrationEvents.forEach((ev, i) => {
    const sortMs = Date.parse(ev.timestamp);
    rows.push({
      source: "sqlite",
      sortMs: Number.isFinite(sortMs) ? sortMs : 0,
      title: ev.type,
      detail: `${ev.timestamp} · v${ev.stateVersion} · ${ev.triggeredBy}`,
      stableKey: `sqlite:${ev.timestamp}:${ev.type}:${ev.stateVersion}:${i}`,
      isoTime: toIsoOrEmpty(ev.timestamp)
    });
  });
  for (const row of data.postgresTimeline) {
    const sortMs = Date.parse(row.createdAt);
    rows.push({
      source: "postgres",
      sortMs: Number.isFinite(sortMs) ? sortMs : 0,
      title: row.eventType,
      detail: row.createdAt,
      stableKey: `pg:${row.id}`,
      isoTime: toIsoOrEmpty(row.createdAt)
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
