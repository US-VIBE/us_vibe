import { describe, expect, it } from "vitest";
import { createIdlePrSnapshot } from "./pr-review-service";
import type { RetroReport } from "./retro-types";
import { buildSprintCheckpoints } from "./sprint-progress";

const sampleRetro = (sessionId: string): RetroReport => ({
  id: "r1",
  sessionId,
  createdAt: new Date().toISOString(),
  kpis: {
    roleBalanceScore: 70,
    reworkRatePercent: 12,
    reviewReflectionPercent: 80,
    communicationScore: 65
  },
  nextActions: ["a", "b", "c"]
});

describe("buildSprintCheckpoints", () => {
  it("요구사항·계약·PR·회고 완료 시 모두 done", () => {
    const sid = "00000000-0000-4000-8000-000000000099";
    const prSnap = {
      ...createIdlePrSnapshot(sid),
      phase: "approved" as const,
      prNumber: 1,
      branch: "feature/x"
    };
    const cps = buildSprintCheckpoints({
      specApproved: true,
      contractApproved: true,
      prSnap,
      retroReports: [sampleRetro(sid)]
    });
    expect(cps.map((c) => c.done)).toEqual([true, true, true, true]);
  });

  it("초기 상태면 모두 미완", () => {
    const sid = "00000000-0000-4000-8000-000000000088";
    const cps = buildSprintCheckpoints({
      specApproved: false,
      contractApproved: false,
      prSnap: createIdlePrSnapshot(sid),
      retroReports: []
    });
    expect(cps.map((c) => c.done)).toEqual([false, false, false, false]);
  });
});
