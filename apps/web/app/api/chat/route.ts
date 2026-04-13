import { NextResponse } from "next/server";
import {
  buildCollaborationContextLines,
  COLLAB_LEARNER_SUMMARY_LINE,
  learnerFocusFromSessionRole
} from "../../../lib/collaboration-chat-context";

/** OpenAI Chat Completions — 사용자 멀티모달 */
type OpenAiUserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** Nest `POST .../chat-images` 저장 후 클라이언트가 보내는 참조 — 서버에서 data URL로 치환 */
type ImageRefPart = { type: "image_ref"; imageId: string; mime: string };

type UserContentPart = OpenAiUserContentPart | ImageRefPart;

type HistoryTurn = { role: "user" | "assistant"; content: string | UserContentPart[] };

type OpenAiHistoryTurn = {
  role: "user" | "assistant";
  content: string | OpenAiUserContentPart[];
};

type Body = {
  session?: {
    /** Nest 채팅 이미지(`image_ref`) 해소에 필요 */
    sessionId?: string;
    topic?: string;
    goal?: string;
    sprintDays?: number;
    proficiency?: string;
    /** `backend_developer` | `frontend_developer` — 생략 시 백엔드 */
    learnerRole?: string;
    /** 세션에 켜 둔 AI 역할군 — 협업 컨텍스트 주입에 사용, 생략 시 백엔드 솔로 MVP 기본 */
    activatedAiRoleLabels?: string[];
  };
  agent?: { agentId?: string; role?: string; displayName?: string };
  history?: HistoryTurn[];
  /** Nest API 베이스(끝 `/` 없음). `image_ref`가 있을 때 필수 */
  nestApiBase?: string;
  /** 워크스페이스 로그인 액세스 토큰 — Next 서버가 Nest에서 이미지 바이트를 받을 때 사용 */
  nestAccessToken?: string;
};

const MAX_IMAGE_DATA_URL_CHARS = 3_600_000;
const MAX_TEXT_PART_CHARS = 12_000;
const MAX_USER_PARTS = 16;

function isOpenAiUserContentPart(x: unknown): x is OpenAiUserContentPart {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.type === "text") {
    return typeof o.text === "string" && o.text.length <= MAX_TEXT_PART_CHARS;
  }
  if (o.type === "image_url" && o.image_url && typeof o.image_url === "object") {
    const url = (o.image_url as { url?: unknown }).url;
    if (typeof url !== "string" || url.length > MAX_IMAGE_DATA_URL_CHARS) return false;
    if (!/^data:image\/(png|jpeg|webp);base64,/i.test(url)) return false;
    return true;
  }
  return false;
}

function isImageRefPart(x: unknown): x is ImageRefPart {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.type !== "image_ref") return false;
  if (typeof o.imageId !== "string" || o.imageId.length < 8 || o.imageId.length > 128) return false;
  if (!/^[a-zA-Z0-9-]+$/.test(o.imageId)) return false;
  if (typeof o.mime !== "string" || !/^image\/(png|jpeg|webp)$/i.test(o.mime)) return false;
  return true;
}

function isUserContentPart(x: unknown): x is UserContentPart {
  return isOpenAiUserContentPart(x) || isImageRefPart(x);
}

function isHistoryTurn(x: unknown): x is HistoryTurn {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.role !== "user" && o.role !== "assistant") return false;
  if (typeof o.content === "string") {
    return o.content.length <= 32000;
  }
  if (!Array.isArray(o.content)) return false;
  if (o.content.length === 0 || o.content.length > MAX_USER_PARTS) return false;
  if (o.role === "assistant") return false;
  return o.content.every(isUserContentPart);
}

function historyUsesOpenAiVision(history: HistoryTurn[]): boolean {
  return history.some((h) => {
    if (h.role !== "user" || typeof h.content === "string") return false;
    return h.content.some((p) => p.type === "image_url" || p.type === "image_ref");
  });
}

function historyHasImageRef(history: HistoryTurn[]): boolean {
  return history.some(
    (h) =>
      h.role === "user" &&
      Array.isArray(h.content) &&
      h.content.some((p) => p.type === "image_ref")
  );
}

async function resolveNestImageRefsForOpenAI(input: {
  history: HistoryTurn[];
  sessionId: string;
  nestApiBase: string;
  nestAccessToken: string;
}): Promise<OpenAiHistoryTurn[]> {
  const base = input.nestApiBase.replace(/\/$/, "");
  const out: OpenAiHistoryTurn[] = [];
  for (const h of input.history) {
    if (h.role === "assistant") {
      out.push({ role: "assistant", content: typeof h.content === "string" ? h.content : "" });
      continue;
    }
    if (typeof h.content === "string") {
      out.push({ role: "user", content: h.content });
      continue;
    }
    const parts: OpenAiUserContentPart[] = [];
    for (const p of h.content) {
      if (p.type === "image_ref") {
        const url = `${base}/api/sessions/${encodeURIComponent(input.sessionId)}/chat-images/${encodeURIComponent(p.imageId)}/file`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${input.nestAccessToken}`, Accept: "*/*" }
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(
            `NEST_CHAT_IMAGE_FETCH_${res.status}${t ? `: ${t.slice(0, 200)}` : ""}`
          );
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        let b64 = "";
        try {
          b64 = Buffer.from(buf).toString("base64");
        } catch {
          let bin = "";
          for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
          b64 = btoa(bin);
        }
        const mimeNorm = /^image\/jpeg$/i.test(p.mime) ? "image/jpeg" : p.mime.toLowerCase();
        const dataUrl = `data:${mimeNorm};base64,${b64}`;
        if (dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
          throw new Error("NEST_CHAT_IMAGE_TOO_LARGE");
        }
        parts.push({ type: "image_url", image_url: { url: dataUrl } });
      } else {
        parts.push(p);
      }
    }
    out.push({ role: "user", content: parts });
  }
  return out;
}

/** Gemini generateContent 응답에서 텍스트 추출 */
function extractGeminiText(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const candidates = o.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const c0 = candidates[0] as Record<string, unknown>;
  const content = c0.content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const p0 = parts[0] as Record<string, unknown>;
  return typeof p0.text === "string" ? p0.text : null;
}

function buildSystemPrompt(input: {
  role: string;
  name: string;
  topic: string;
  goal: string;
  sprint: number;
  prof: string;
  learnerRole?: string;
  activatedAiRoleLabels?: readonly string[];
}): string {
  const who = `당신은 소프트웨어 개발 스프린트 협업 시뮬레이션에서 ${input.role} 역할의 AI 동료「${input.name}」입니다.`;
  const focus = learnerFocusFromSessionRole(input.learnerRole);
  const collaboration = buildCollaborationContextLines({
    learnerRole: input.learnerRole,
    activatedAiRoleLabels: input.activatedAiRoleLabels,
    replyingAgentRole: input.role
  });
  const learnerLine = COLLAB_LEARNER_SUMMARY_LINE[focus];
  return [
    who,
    ...collaboration,
    learnerLine,
    `주제: ${input.topic}`,
    `목표: ${input.goal}`,
    `스프린트: ${input.sprint}일 · 숙련도: ${input.prof}`,
    `답변은 한국어로, 실무에 도움이 되게 짧고 구체적으로 작성하세요. 불필요한 장황한 인사는 줄입니다.`
  ].join("\n");
}

function geminiErrorMessage(raw: unknown, statusText: string): string {
  if (raw && typeof raw === "object" && "error" in raw) {
    return String((raw as { error?: { message?: string } }).error?.message ?? statusText);
  }
  return statusText;
}

/** 쿼터·레이트 한도 등 → OpenAI로 넘겨도 되는 실패 */
function shouldFallbackGeminiToOpenai(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("quota") ||
    m.includes("rate") ||
    m.includes("resource_exhausted") ||
    m.includes("resource exhausted") ||
    m.includes("429") ||
    m.includes("limit: 0") ||
    m.includes("too many requests")
  );
}

/** OpenAI 권한·스코프 오류일 때 채팅 UI용 짧은 안내 */
function openAiPermissionHint(apiMessage: string): string | null {
  const m = apiMessage.toLowerCase();
  if (!m.includes("insufficient permissions") && !m.includes("missing scopes")) {
    return null;
  }
  return [
    "[조치 안내]",
    "1) platform.openai.com → API keys 에서 새 Secret key 생성",
    "2) Restricted(제한) 키라면 편집에서 모델 호출 스코프(model.request / Chat 등)를 켜거나, 제한 없는 키로 테스트",
    "3) 조직(Organization) 역할이 Reader만이면 Writer 이상으로 변경 요청",
    "4) 키가 특정 프로젝트에만 연결되어 있으면 Settings → Project에서 proj_… ID 확인 후 apps/web/.env.local에 OPENAI_PROJECT_ID=proj_… 추가",
    "5) .env.local 수정 후 Next dev 서버 재시작"
  ].join("\n");
}

function extractOpenAiAssistantText(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const choices = (raw as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const c0 = choices[0] as { message?: { content?: unknown } };
  const c = c0?.message?.content;
  if (typeof c === "string") return c.trim() || null;
  if (Array.isArray(c)) {
    const text = c
      .filter((p): p is { type?: string; text?: string } => p != null && typeof p === "object")
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    const t = text.trim();
    return t || null;
  }
  return null;
}

async function completeWithOpenAI(input: {
  system: string;
  history: OpenAiHistoryTurn[];
  openaiKey: string;
  openaiBase: string;
  openaiModel: string;
}): Promise<NextResponse> {
  const openaiMessages: {
    role: "system" | "user" | "assistant";
    content: string | OpenAiUserContentPart[];
  }[] = [
    { role: "system", content: input.system },
    ...input.history.map((h) => ({ role: h.role, content: h.content }))
  ];

  const openaiProject =
    process.env.OPENAI_PROJECT_ID?.trim() || process.env.OPENAI_PROJECT?.trim();
  const openaiOrg =
    process.env.OPENAI_ORGANIZATION?.trim() || process.env.OPENAI_ORG_ID?.trim();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${input.openaiKey}`
  };
  if (openaiOrg) headers["OpenAI-Organization"] = openaiOrg;
  if (openaiProject) headers["OpenAI-Project"] = openaiProject;

  const res = await fetch(`${input.openaiBase}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: input.openaiModel,
      messages: openaiMessages,
      max_tokens: 1024,
      temperature: 0.7
    })
  });

  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err =
      raw && typeof raw === "object" && "error" in raw
        ? String((raw as { error?: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    const base = err || "OpenAI 요청 실패";
    const hint = openAiPermissionHint(base);
    return NextResponse.json(
      { ok: false, error: "OPENAI", message: hint ? `${base}\n\n${hint}` : base },
      { status: 502 }
    );
  }

  const text = extractOpenAiAssistantText(raw);

  if (!text?.trim()) {
    return NextResponse.json(
      { ok: false, error: "EMPTY", message: "모델 응답이 비어 있습니다." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, text: text.trim(), usedMock: false, provider: "openai" as const });
}

async function completeWithGemini(input: {
  system: string;
  history: OpenAiHistoryTurn[];
  geminiKey: string;
  geminiModel: string;
}): Promise<
  | { ok: true; text: string }
  | { ok: false; httpStatus: number; message: string; fallbackToOpenai: boolean }
> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.geminiModel)}:generateContent?key=${encodeURIComponent(input.geminiKey)}`;

  const contents = input.history.map((h) => {
    const text = typeof h.content === "string" ? h.content : "[첨부: 이미지·파일 — OpenAI 전용]";
    return {
      role: h.role === "user" ? "user" : "model",
      parts: [{ text }]
    };
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7
      }
    })
  });

  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const errMsg = geminiErrorMessage(raw, res.statusText);
    return {
      ok: false,
      httpStatus: 502,
      message: errMsg || "Gemini 요청 실패",
      fallbackToOpenai: shouldFallbackGeminiToOpenai(errMsg)
    };
  }

  const text = extractGeminiText(raw);
  if (!text?.trim()) {
    return {
      ok: false,
      httpStatus: 502,
      message: "모델 응답이 비어 있습니다.",
      fallbackToOpenai: false
    };
  }

  return { ok: true, text: text.trim() };
}

export async function POST(request: Request) {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const openaiBase = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";


  /** `openai`(기본) | `gemini` | `auto`(Gemini 먼저, 쿼터/429류 실패 시 OpenAI) */
  const chatProvider = (process.env.CHAT_PROVIDER ?? "openai").trim().toLowerCase();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON", message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const session = body.session;
  const agent = body.agent;
  const history = body.history;

  if (!session || !agent || !Array.isArray(history)) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION", message: "session, agent, history가 필요합니다." },
      { status: 400 }
    );
  }

  if (!history.every(isHistoryTurn)) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION", message: "history 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const role = agent.role ?? "에이전트";
  const name = agent.displayName ?? role;
  const topic = session.topic ?? "";
  const goal = session.goal ?? "";
  const sprint = session.sprintDays ?? 1;
  const prof = session.proficiency ?? "intermediate";
  const system = buildSystemPrompt({
    role,
    name,
    topic,
    goal,
    sprint,
    prof,
    learnerRole: session.learnerRole,
    activatedAiRoleLabels: session.activatedAiRoleLabels
  });

  let llmHistory: OpenAiHistoryTurn[] = history as OpenAiHistoryTurn[];
  if (historyHasImageRef(history)) {
    const sessionId = typeof session.sessionId === "string" ? session.sessionId.trim() : "";
    const nestApiBase = typeof body.nestApiBase === "string" ? body.nestApiBase.trim() : "";
    const nestAccessToken = typeof body.nestAccessToken === "string" ? body.nestAccessToken.trim() : "";
    if (!sessionId || !nestApiBase || !nestAccessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "NEST_AUTH_REQUIRED",
          message:
            "서버에 저장된 채팅 이미지(image_ref)를 OpenAI로 넘기려면 session.sessionId, nestApiBase, nestAccessToken이 필요합니다. 워크스페이스에서 로그인한 뒤 다시 시도하세요."
        },
        { status: 400 }
      );
    }
    try {
      llmHistory = await resolveNestImageRefsForOpenAI({
        history,
        sessionId,
        nestApiBase,
        nestAccessToken
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "NEST_CHAT_IMAGE_TOO_LARGE") {
        return NextResponse.json(
          {
            ok: false,
            error: "CHAT_IMAGE_TOO_LARGE",
            message: "Nest에서 받은 이미지가 OpenAI 전송 한도를 초과했습니다."
          },
          { status: 413 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "NEST_CHAT_IMAGE_FETCH", message: msg },
        { status: 502 }
      );
    }
  }

  const multimodal = historyUsesOpenAiVision(llmHistory as HistoryTurn[]);
  if (multimodal) {
    if (!openaiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "VISION_REQUIRES_OPENAI",
          message:
            "이미지·파일 첨부 채팅은 OpenAI 비전이 필요합니다. apps/web/.env.local에 OPENAI_API_KEY를 설정하세요."
        },
        { status: 503 }
      );
    }
    return await completeWithOpenAI({
      system,
      history: llmHistory,
      openaiKey,
      openaiBase,
      openaiModel
    });
  }

  if (!geminiKey && !openaiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "NO_API_KEY",
        message:
          "기본은 OpenAI입니다. apps/web/.env.local에 OPENAI_API_KEY를 설정하세요. Gemini를 쓰려면 CHAT_PROVIDER=auto 또는 gemini 와 GEMINI_API_KEY를 넣으세요."
      },
      { status: 503 }
    );
  }

  try {
    if (chatProvider === "openai") {
      if (!openaiKey) {
        return NextResponse.json(
          {
            ok: false,
            error: "NO_OPENAI_KEY",
            message: "CHAT_PROVIDER=openai 인데 OPENAI_API_KEY가 없습니다."
          },
          { status: 503 }
        );
      }
      return await completeWithOpenAI({
        system,
        history: llmHistory,
        openaiKey,
        openaiBase,
        openaiModel
      });
    }

    if (chatProvider === "gemini") {
      if (!geminiKey) {
        return NextResponse.json(
          {
            ok: false,
            error: "NO_GEMINI_KEY",
            message: "CHAT_PROVIDER=gemini 인데 GEMINI_API_KEY가 없습니다."
          },
          { status: 503 }
        );
      }
      const g = await completeWithGemini({ system, history: llmHistory, geminiKey, geminiModel });
      if (g.ok) {
        return NextResponse.json({ ok: true, text: g.text, usedMock: false, provider: "gemini" as const });
      }
      return NextResponse.json({ ok: false, error: "GEMINI", message: g.message }, { status: g.httpStatus });
    }

    // --- auto (기본) ---
    if (geminiKey) {
      const g = await completeWithGemini({ system, history: llmHistory, geminiKey, geminiModel });
      if (g.ok) {
        return NextResponse.json({ ok: true, text: g.text, usedMock: false, provider: "gemini" as const });
      }
      if (g.fallbackToOpenai && openaiKey) {
        return await completeWithOpenAI({
          system,
          history: llmHistory,
          openaiKey,
          openaiBase,
          openaiModel
        });
      }
      return NextResponse.json({ ok: false, error: "GEMINI", message: g.message }, { status: g.httpStatus });
    }

    if (openaiKey) {
      return await completeWithOpenAI({
        system,
        history: llmHistory,
        openaiKey,
        openaiBase,
        openaiModel
      });
    }

    return NextResponse.json(
      { ok: false, error: "NO_API_KEY", message: "사용 가능한 LLM 키가 없습니다." },
      { status: 503 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: "NETWORK", message: msg }, { status: 502 });
  }
}
