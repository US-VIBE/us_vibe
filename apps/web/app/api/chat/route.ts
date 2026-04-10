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

export async function POST(request: Request) {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const openaiBase = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

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
          "GEMINI_API_KEY(권장) 또는 OPENAI_API_KEY를 apps/web/.env.local에 설정하세요."
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

  const system = [
    `당신은 소프트웨어 개발 스프린트 협업 시뮬레이션에서 ${role} 역할의 AI 동료「${name}」입니다.`,
    `학습자는 백엔드 개발자이며, 함께 주제와 목표를 진행합니다.`,
    `주제: ${topic}`,
    `목표: ${goal}`,
    `스프린트: ${sprint}일 · 숙련도: ${prof}`,
    `답변은 한국어로, 실무에 도움이 되게 짧고 구체적으로 작성하세요. 불필요한 장황한 인사는 줄입니다.`
  ].join("\n");

  try {
    if (geminiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`;

      const contents = history.map((h) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.content }]
      }));

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7
          }
        })
      });

      const raw: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg =
          raw && typeof raw === "object" && "error" in raw
            ? String((raw as { error?: { message?: string } }).error?.message ?? res.statusText)
            : res.statusText;
        return NextResponse.json(
          { ok: false, error: "GEMINI", message: errMsg || "Gemini 요청 실패" },
          { status: 502 }
        );
      }

      const text = extractGeminiText(raw);
      if (!text?.trim()) {
        return NextResponse.json(
          { ok: false, error: "EMPTY", message: "모델 응답이 비어 있습니다." },
          { status: 502 }
        );
      }

      return NextResponse.json({ ok: true, text: text.trim(), usedMock: false });
    }

    const openaiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: system },
      ...history.map((h) => ({ role: h.role, content: h.content }))
    ];

    const res = await fetch(`${openaiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: openaiModel,
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
      return NextResponse.json(
        { ok: false, error: "OPENAI", message: err || "OpenAI 요청 실패" },
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

    return NextResponse.json({ ok: true, text: text.trim(), usedMock: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: "NETWORK", message: msg }, { status: 502 });
  }
}
