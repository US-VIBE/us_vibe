import { describe, expect, it } from "vitest";
import type { IntegrationEvent } from "../../../specs/data-model/types";
import {
  filterIntegrationEventsForTimeline,
  filterPostgresTimelineUnknown,
  mergeUnifiedTimelineRows,
  matchesEventTypeTokens,
} from "../../src/integration/unified-timeline-merge.util";

function ev(
  type: IntegrationEvent["type"],
  ts: string,
  v = 1
): IntegrationEvent {
  return {
    type,
    sessionId: "s",
    stateVersion: v,
    triggeredBy: "github",
    payload: { prNumber: 1, branch: "main", author: "a" },
    timestamp: ts,
  };
}

describe("unified-timeline-merge.util", () => {
  it("matchesEventTypeTokens is case-insensitive substring", () => {
    expect(matchesEventTypeTokens("PR_OPENED", ["pr_"])).toBe(true);
    expect(matchesEventTypeTokens("VALIDATION_FAILED", ["fail"])).toBe(true);
    expect(matchesEventTypeTokens("PR_OPENED", ["zzz"])).toBe(false);
  });

  it("filterIntegrationEventsForTimeline filters by tokens", () => {
    const events = [ev("PR_OPENED", "2020-01-02T00:00:00.000Z"), ev("VALIDATION_FAILED", "2020-01-01T00:00:00.000Z")];
    const out = filterIntegrationEventsForTimeline(events, ["VALIDATION"]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("VALIDATION_FAILED");
  });

  it("mergeUnifiedTimelineRows sorts desc by default branch", () => {
    const sqlite = [ev("PR_OPENED", "2020-01-01T00:00:00.000Z"), ev("PR_OPENED", "2020-01-03T00:00:00.000Z")];
    const pg = [
      { id: "1", eventType: "agent_reply", createdAt: "2020-01-02T00:00:00.000Z" },
    ];
    const merged = mergeUnifiedTimelineRows(sqlite, pg, {
      sources: "both",
      typeTokens: [],
      sortOrder: "desc",
    });
    expect(merged[0].sortMs >= merged[1].sortMs).toBe(true);
  });

  it("mergeUnifiedTimelineRows respects sources sqlite only", () => {
    const sqlite = [ev("PR_OPENED", "2020-01-01T00:00:00.000Z")];
    const pg = [{ id: "1", eventType: "x", createdAt: "2020-01-02T00:00:00.000Z" }];
    const merged = mergeUnifiedTimelineRows(sqlite, pg, {
      sources: "sqlite",
      typeTokens: [],
      sortOrder: "desc",
    });
    expect(merged.every((r) => r.source === "sqlite")).toBe(true);
  });

  it("filterPostgresTimelineUnknown keeps matching eventType", () => {
    const rows = [
      { id: "a", eventType: "retro_complete", createdAt: "2020-01-01T00:00:00.000Z" },
      { id: "b", eventType: "other", createdAt: "2020-01-02T00:00:00.000Z" },
    ];
    const out = filterPostgresTimelineUnknown(rows, ["retro"]);
    expect(out).toHaveLength(1);
    expect((out[0] as { eventType: string }).eventType).toBe("retro_complete");
  });
});
