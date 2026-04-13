import { getAccessToken } from "./auth-storage";
import type { LearningSession } from "./session-types";
import type { InjectedAgent } from "./role-gap-types";
import type { ChatAttachment, ChatMessage } from "./chat-types";

const MAX_HISTORY_MESSAGES = 24;

export type ChatApiResponse =
  | { ok: true; text: string; usedMock: boolean }
  | { ok: false; error: string };

/** POST /api/chat 의 history 한 턴 — OpenAI 멀티모달 + Nest 저장 이미지 참조 */
type ApiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "image_ref"; imageId: string; mime: string };

function userAttachmentsToContentParts(
  text: string,
  attachments: ChatAttachment[] | undefined
): string | ApiContentPart[] {
  if (!attachments?.length) {
    const t = text.trim();
    return t.length > 0 ? t : "(메시지 없음)";
  }
  const parts: ApiContentPart[] = [];
  const lead = text.trim() || "(첨부 스크린샷·파일 참고)";
  parts.push({ type: "text", text: lead });
  for (const a of attachments) {
    if (a.type === "image") {
      parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
    } else if (a.type === "image_ref") {
      parts.push({ type: "image_ref", imageId: a.imageId, mime: a.mime });
    } else {
      parts.push({
        type: "text",
        text: `\n\n첨부 파일 \`${a.name}\` (${a.mime}):\n\n\`\`\`\n${a.preview}\n\`\`\`\n`
      });
    }
  }
  return parts;
}

function messageToTurn(
  m: ChatMessage
): { role: "user" | "assistant"; content: string | ApiContentPart[] } | null {
  if (m.kind === "agent") {
    return { role: "assistant", content: m.text };
  }
  if (m.kind === "user") {
    return { role: "user", content: userAttachmentsToContentParts(m.text, m.attachments) };
  }
  return null;
}

function buildHistory(
  messages: ChatMessage[],
  userText: string,
  userAttachments?: ChatAttachment[]
): { role: "user" | "assistant"; content: string | ApiContentPart[] }[] {
  const out: { role: "user" | "assistant"; content: string | ApiContentPart[] }[] = [];
  for (const m of messages) {
    const t = messageToTurn(m);
    if (t) out.push(t);
  }
  out.push({ role: "user", content: userAttachmentsToContentParts(userText, userAttachments) });
  return out.slice(-MAX_HISTORY_MESSAGES);
}

function mockReply(replier: InjectedAgent): string {
  return `${replier.displayName}입니다. 메시지 확인했습니다. (목업 응답 — apps/web/.env.local에 OPENAI_API_KEY를 넣고 dev 서버를 재시작하세요. Gemini는 CHAT_PROVIDER=auto|gemini 일 때 GEMINI_API_KEY.)`;
}

/**
 * 에이전트 답변: 서버 `POST /api/chat` — 기본 OpenAI(텍스트·이미지·텍스트 파일 첨부).
 */
export async function fetchAgentReply(input: {
  session: LearningSession;
  agent: InjectedAgent;
  messages: ChatMessage[];
  userText: string;
  userAttachments?: ChatAttachment[];
}): Promise<ChatApiResponse> {
  const { session, agent, messages, userText, userAttachments } = input;
  const history = buildHistory(messages, userText, userAttachments);

  try {
    const nestApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    const nestAccessToken = getAccessToken() ?? undefined;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        session: {
          sessionId: session.sessionId,
          topic: session.topic,
          goal: session.goal,
          sprintDays: session.sprintDays,
          proficiency: session.proficiency,
          learnerRole: session.learnerRole,
          activatedAiRoleLabels: [...session.activatedAiRoleLabels]
        },
        agent: {
          agentId: agent.agentId,
          role: agent.role,
          displayName: agent.displayName
        },
        history,
        ...(nestApiBase ? { nestApiBase } : {}),
        ...(nestAccessToken ? { nestAccessToken } : {})
      })
    });

    const rawText = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(rawText) as unknown;
    } catch {
      json = null;
    }
    const o = json && typeof json === "object" ? (json as Record<string, unknown>) : null;

    if (res.status === 503 && o) {
      const err = typeof o.error === "string" ? o.error : "";
      if (err === "NO_API_KEY" || err === "NO_OPENAI_KEY") {
        return { ok: true, text: mockReply(agent), usedMock: true };
      }
      if (typeof o.message === "string") {
        return { ok: false, error: o.message };
      }
    }

    if (!res.ok) {
      const errMsg =
        o && typeof o.message === "string"
          ? o.message
          : o && typeof o.error === "string"
            ? o.error
            : `요청 실패 (${res.status})`;
      return { ok: false, error: errMsg };
    }

    if (!o) {
      return { ok: false, error: "응답을 해석하지 못했습니다." };
    }

    if (o.ok === true && typeof o.text === "string") {
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
