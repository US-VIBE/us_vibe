import { describe, expect, it } from "vitest";
import { createIdlePrSnapshot } from "./pr-review-service";
import { SOLO_BE_ACTIVATED_AI_ROLES, type LearningSession } from "./session-types";
import { buildThinkingR1Lines } from "./thinking-r1";

function makeSession(): LearningSession {
  return {
    sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    learnerRole: "backend_developer",
    goal: "학습",
    topic: "로그인 기능",
    sprintDays: 3,
    proficiency: "intermediate",
    activatedAiRoleLabels: [...SOLO_BE_ACTIVATED_AI_ROLES],
    createdAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("buildThinkingR1Lines", () => {
  it("gapLoading이면 역할 스냅샷 로드 중 문구 포함", () => {
    const session = makeSession();
    const lines = buildThinkingR1Lines({
      session,
      gapLoading: true,
      roleGap: null,
      gapError: null,
      activeStory: "s1",
      specApproved: false,
      specConversion: null,
      convertLoading: false,
      approveLoading: false,
      prSnap: createIdlePrSnapshot(session.sessionId),
      contractApproved: false,
      validationResult: null,
      contractBusy: null,
      retroReportsCount: 0,
      chatSending: false,
      messagesLength: 0
    });
    expect(lines.some((l) => l.includes("동기화 중"))).toBe(true);
  });
});
