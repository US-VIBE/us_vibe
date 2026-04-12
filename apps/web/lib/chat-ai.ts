import type { LearningSession } from "./session-types";
import type { InjectedAgent } from "./role-gap-types";
import type { ChatMessage } from "./chat-types";

const MAX_HISTORY_MESSAGES = 24;

export type ChatApiResponse =
  | { ok: true; text: string; usedMock: boolean }
  | { ok: false; error: string };

function buildHistory(
  messages: ChatMessage[],
  userText: string
): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.kind === "user") out.push({ role: "user", content: m.text });
    if (m.kind === "agent") out.push({ role: "assistant", content: m.text });
  }
  out.push({ role: "user", content: userText });
  return out.slice(-MAX_HISTORY_MESSAGES);
}

function mockReply(replier: InjectedAgent): string {
  return `${replier.displayName}입니다. 메시지 확인했습니다. (목업 응답 — apps/web/.env.local에 GEMINI_API_KEY 또는 OPENAI_API_KEY를 넣고 dev 서버를 재시작하세요.)`;
}

/**
 * 에이전트 답변: 서버 `POST /api/chat` — CHAT_PROVIDER·키에 따라 Gemini/OpenAI(및 auto 폴백). 503만 목업.
 */
export async function fetchAgentReply(input: {
  session: LearningSession;
  agent: InjectedAgent;
  messages: ChatMessage[];
  userText: string;
}): Promise<ChatApiResponse> {
  const { session, agent, messages, userText } = input;
  const history = buildHistory(messages, userText);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        session: {
          topic: session.topic,
          goal: session.goal,
          sprintDays: session.sprintDays,
          proficiency: session.proficiency
        },
        agent: {
          agentId: agent.agentId,
          role: agent.role,
          displayName: agent.displayName
        },
        history
      })
    });

    if (res.status === 503) {
      return { ok: true, text: mockReply(agent), usedMock: true };
    }

    const json: unknown = await res.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return { ok: false, error: "응답을 해석하지 못했습니다." };
    }
    const o = json as Record<string, unknown>;

    if (res.ok && o.ok === true && typeof o.text === "string") {
      return { ok: true, text: o.text, usedMock: o.usedMock === true };
    }

    const errMsg =
      typeof o.message === "string"
        ? o.message
        : typeof o.error === "string"
          ? o.error
          : `요청 실패 (${res.status})`;
    return { ok: false, error: errMsg };
  } catch (e) {
    console.warn("[chat-ai] fetch 실패, 목업", e);
    return { ok: true, text: mockReply(agent), usedMock: true };
  }
}
