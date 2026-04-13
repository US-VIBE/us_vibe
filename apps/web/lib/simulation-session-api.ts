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
      credentials: "include",
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

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 기존 Postgres 시뮬 세션과 맞출 때: GET /sessions/:id 로 존재 여부 확인.
 */
export async function verifySimulationSessionExists(id: string): Promise<boolean> {
  const trimmed = id.trim();
  if (!UUID_V4.test(trimmed)) {
    return false;
  }
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) {
    return false;
  }
  try {
    const res = await apiFetch(`${base}/sessions/${encodeURIComponent(trimmed)}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    return res.ok;
  } catch {
    return false;
  }
}
