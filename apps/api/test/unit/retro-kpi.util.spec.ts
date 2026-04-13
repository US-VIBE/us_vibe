import { describe, expect, it } from "vitest";
import type { IntegrationEvent } from "../../../specs/data-model/types";
import {
  buildRetroKpiEvidence,
  buildKpiBasisSummary,
  computeRetroKpisFromEvents,
} from "../../src/session/retro-kpi.util";

function ev(type: IntegrationEvent["type"], ts: string, pr = 1): IntegrationEvent {
  return {
    type,
    sessionId: "s",
    stateVersion: 1,
    triggeredBy: "github",
    payload: { prNumber: pr, branch: "main", author: "u" } as IntegrationEvent["payload"],
    timestamp: ts,
  };
}

describe("retro-kpi.util", () => {
  it("computeRetroKpisFromEvents returns bounded scores", () => {
    const events: IntegrationEvent[] = [ev("VALIDATION_PASSED", "2020-01-01T00:00:00.000Z", 1)];
    const k = computeRetroKpisFromEvents(events);
    expect(k.roleBalanceScore).toBeGreaterThanOrEqual(0);
    expect(k.roleBalanceScore).toBeLessThanOrEqual(99);
    expect(k.reworkRatePercent).toBeLessThanOrEqual(95);
  });

  it("buildKpiBasisSummary mentions counts", () => {
    const events = [
      ev("VALIDATION_FAILED", "2020-01-02T00:00:00.000Z", 2),
      ev("PR_UPDATED", "2020-01-01T00:00:00.000Z", 2),
    ];
    const s = buildKpiBasisSummary(events);
    expect(s).toContain("2건");
    expect(s).toContain("실패");
  });

  it("buildRetroKpiEvidence returns four blocks with citations sorted recent first", () => {
    const events: IntegrationEvent[] = [
      ev("VALIDATION_FAILED", "2020-01-03T00:00:00.000Z", 9),
      ev("VALIDATION_FAILED", "2020-01-01T00:00:00.000Z", 8),
      ev("PR_UPDATED", "2020-01-02T00:00:00.000Z", 7),
    ];
    const blocks = buildRetroKpiEvidence(events);
    expect(blocks).toHaveLength(4);
    const rework = blocks.find((b) => b.key === "rework");
    expect(rework).toBeDefined();
    expect(rework!.citations.length).toBeGreaterThanOrEqual(1);
    expect(rework!.citations[0].eventType).toBe("VALIDATION_FAILED");
    expect(rework!.citations[0].timestamp).toBe("2020-01-03T00:00:00.000Z");
  });
});
