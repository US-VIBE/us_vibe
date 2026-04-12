import { apiFetch } from "./api-fetch";
import type { LearningSession } from "./session-types";

const PROF_TO_SKILL: Record<LearningSession["proficiency"], string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급"
};

/**
 * Postgres 시뮬 세션 생성 — 응답 `id`를 학습 `sessionId`로 쓰면 웹훅·타임라인과 맞출 수 있음 (F-1).
 * `NEXT_PUBLIC_API_URL` 없거나 API 실패 시 `null`.
 */
export async function createSimulationSessionForWorkspace(input: {
  goal: string;
  topic: string;
  sprintDays: 1 | 3 | 7;
  proficiency: LearningSession["proficiency"];
}): Promise<{ id: string } | null> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) {
    return null;
  }
  const learningGoal = input.goal.trim();
  const topic = input.topic.trim();
  const sprintDuration = `${input.sprintDays}일`;
  const skillLevel = PROF_TO_SKILL[input.proficiency];
  if (!learningGoal || !topic) {
    return null;
  }
  try {
    const res = await apiFetch(`${base}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        learnerRole: "Backend Developer",
        learningGoal,
        topic,
        sprintDuration,
        skillLevel
      })
    });
    if (!res.ok) {
      return null;
    }
    const row = (await res.json()) as { id?: string };
    if (typeof row?.id !== "string" || !row.id) {
      return null;
    }
    return { id: row.id };
  } catch {
    return null;
  }
}
