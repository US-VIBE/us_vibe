import type { IntegrationEvent } from "../../../../specs/data-model/types";

export type UnifiedTimelineSourceFilter = "both" | "sqlite" | "postgres";

export type UnifiedMergedRow = {
  source: "sqlite" | "postgres";
  sortMs: number;
  title: string;
  detail: string;
  stableKey: string;
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

export function matchesEventTypeTokens(title: string, tokens: string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }
  const t = title.toLowerCase();
  return tokens.some((tok) => t.includes(tok.toLowerCase()));
}

/** unified-timeline 쿼리와 동일 규칙으로 SQLite 이벤트만 필터 */
export function filterIntegrationEventsForTimeline(
  events: IntegrationEvent[],
  typeTokens: string[]
): IntegrationEvent[] {
  if (typeTokens.length === 0) {
    return events;
  }
  return events.filter((ev) => matchesEventTypeTokens(ev.type, typeTokens));
}

/** Postgres 타임라인 원본(unknown[])에서 유형 토큰에 맞는 행만 유지 */
export function filterPostgresTimelineUnknown(
  rows: unknown[],
  typeTokens: string[]
): unknown[] {
  if (typeTokens.length === 0) {
    return rows;
  }
  return rows.filter((r) => {
    if (!r || typeof r !== "object") {
      return false;
    }
    const et = (r as Record<string, unknown>).eventType;
    return typeof et === "string" && matchesEventTypeTokens(et, typeTokens);
  });
}

export function mergeUnifiedTimelineRows(
  integrationEvents: IntegrationEvent[],
  postgresTimeline: Array<{ id: string; eventType: string; createdAt: string }>,
  opts: {
    sources: UnifiedTimelineSourceFilter;
    typeTokens: string[];
    sortOrder: "asc" | "desc";
  }
): UnifiedMergedRow[] {
  const rows: UnifiedMergedRow[] = [];
  const includeSqlite = opts.sources === "both" || opts.sources === "sqlite";
  const includePg = opts.sources === "both" || opts.sources === "postgres";

  if (includeSqlite) {
    integrationEvents.forEach((ev, i) => {
      if (!matchesEventTypeTokens(ev.type, opts.typeTokens)) {
        return;
      }
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
  }

  if (includePg) {
    for (const row of postgresTimeline) {
      if (!matchesEventTypeTokens(row.eventType, opts.typeTokens)) {
        continue;
      }
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
  }

  rows.sort((a, b) => (opts.sortOrder === "asc" ? a.sortMs - b.sortMs : b.sortMs - a.sortMs));
  return rows;
}

export function parseCommaTokens(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseUnifiedTimelineSources(
  raw: string | undefined
): UnifiedTimelineSourceFilter {
  const v = raw?.trim().toLowerCase();
  if (v === "sqlite" || v === "postgres") {
    return v;
  }
  return "both";
}

export function parseSortOrder(raw: string | undefined): "asc" | "desc" {
  return raw?.trim().toLowerCase() === "asc" ? "asc" : "desc";
}
