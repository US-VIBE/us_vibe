import { SOLO_BE_ACTIVATED_AI_ROLES, type LearningSession } from "./session-types";

export const SESSION_STORAGE_KEY = "usvibe_learning_session";

function normalizeSession(parsed: LearningSession): LearningSession {
  const learnerRole = parsed.learnerRole ?? "backend_developer";
  const labels = parsed.activatedAiRoleLabels;
  const activatedAiRoleLabels =
    Array.isArray(labels) && labels.length > 0 ? labels : [...SOLO_BE_ACTIVATED_AI_ROLES];
  return { ...parsed, learnerRole, activatedAiRoleLabels };
}

export function loadSession(): LearningSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LearningSession;
    if (!parsed?.sessionId || !parsed?.topic) return null;
    return normalizeSession(parsed);
  } catch {
    return null;
  }
}

export function saveSession(session: LearningSession): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function createSoloBeSession(input: {
  goal: string;
  topic: string;
  sprintDays: 1 | 3 | 7;
  proficiency: LearningSession["proficiency"];
  scenarioId?: string;
  briefingMarkdown?: string;
  sessionId?: string;
  learnerRole?: LearningSession["learnerRole"];
  /** 생략 시 SOLO_BE 전원 */
  activatedAiRoleLabels?: readonly string[];
}): LearningSession {
  return {
    sessionId: input.sessionId?.trim() || crypto.randomUUID(),
    learnerRole: input.learnerRole ?? "backend_developer",
    goal: input.goal.trim(),
    topic: input.topic.trim(),
    scenarioId: input.scenarioId?.trim() || undefined,
    briefingMarkdown: input.briefingMarkdown?.trim() || undefined,
    sprintDays: input.sprintDays,
    proficiency: input.proficiency,
    activatedAiRoleLabels: input.activatedAiRoleLabels?.length
      ? [...input.activatedAiRoleLabels]
      : [...SOLO_BE_ACTIVATED_AI_ROLES],
    createdAt: new Date().toISOString()
  };
}
