import { NextResponse } from "next/server";

type HistoryTurn = { role: "user" | "assistant"; content: string };

type Body = {
  session?: {
    topic?: string;
    goal?: string;
    sprintDays?: number;
    proficiency?: string;
  };
  agent?: { agentId?: string; role?: string; displayName?: string };
  history?: HistoryTurn[];
};

function isHistoryTurn(x: unknown): x is HistoryTurn {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    (o.role === "user" || o.role === "assistant") &&
    typeof o.content === "string" &&
    o.content.length <= 32000
  );
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
}): string {
  return [
    `당신은 소프트웨어 개발 스프린트 협업 시뮬레이션에서 ${input.role} 역할의 AI 동료「${input.name}」입니다.`,
    `학습자는 백엔드 개발자이며, 함께 주제와 목표를 진행합니다.`,
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

async function completeWithOpenAI(input: {
  system: string;
  history: HistoryTurn[];
  openaiKey: string;
  openaiBase: string;
  openaiModel: string;
}): Promise<NextResponse> {
  const openaiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
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

  const text =
    raw &&
    typeof raw === "object" &&
    "choices" in raw &&
    Array.isArray((raw as { choices?: unknown }).choices) &&
    (raw as { choices: { message?: { content?: string } }[] }).choices[0]?.message?.content;

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { ok: false, error: "EMPTY", message: "모델 응답이 비어 있습니다." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, text: text.trim(), usedMock: false, provider: "openai" as const });
}

async function completeWithGemini(input: {
  system: string;
  history: HistoryTurn[];
  geminiKey: string;
  geminiModel: string;
}): Promise<
  | { ok: true; text: string }
  | { ok: false; httpStatus: number; message: string; fallbackToOpenai: boolean }
> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.geminiModel)}:generateContent?key=${encodeURIComponent(input.geminiKey)}`;

  const contents = input.history.map((h) => ({
    role: h.role === "user" ? "user" : "model",
    parts: [{ text: h.content }]
  }));

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

  /** `openai` | `gemini` | `auto`(기본: Gemini 먼저, 쿼터 실패 시 OpenAI) */
  const chatProvider = (process.env.CHAT_PROVIDER ?? "auto").trim().toLowerCase();

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

  if (!geminiKey && !openaiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "NO_API_KEY",
        message:
          "GEMINI_API_KEY 또는 OPENAI_API_KEY를 apps/web/.env.local에 설정하세요. OpenAI만 쓰려면 CHAT_PROVIDER=openai 입니다."
      },
      { status: 503 }
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
    prof
  });

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
        history,
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
      const g = await completeWithGemini({ system, history, geminiKey, geminiModel });
      if (g.ok) {
        return NextResponse.json({ ok: true, text: g.text, usedMock: false, provider: "gemini" as const });
      }
      return NextResponse.json({ ok: false, error: "GEMINI", message: g.message }, { status: g.httpStatus });
    }

    // --- auto (기본) ---
    if (geminiKey) {
      const g = await completeWithGemini({ system, history, geminiKey, geminiModel });
      if (g.ok) {
        return NextResponse.json({ ok: true, text: g.text, usedMock: false, provider: "gemini" as const });
      }
      if (g.fallbackToOpenai && openaiKey) {
        return await completeWithOpenAI({
          system,
          history,
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
        history,
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
