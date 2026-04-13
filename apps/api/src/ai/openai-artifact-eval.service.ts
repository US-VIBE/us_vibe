import { Injectable, Logger } from "@nestjs/common";

/** 산출물 평가 프롬프트 버전 — `evaluation_json.promptVersion` */
export const ARTIFACT_EVAL_PROMPT_VERSION = "artifact-eval-openai-v1";

@Injectable()
export class OpenAIArtifactEvalService {
  private readonly logger = new Logger(OpenAIArtifactEvalService.name);

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  private buildUserText(kind: string): string {
    const common =
      "당신은 시니어 개발자 겸 리뷰어입니다. 첨부 이미지는 학습 시뮬레이션에서 제출된 산출물입니다.\n" +
      "한국어로, 불릿 위주로 짧게(총 400자 내외) 작성하세요.\n" +
      "다음을 포함하세요: (1) 한 줄 요약 (2) 잘된 점 1~2가지 (3) 개선·확인이 필요한 점 1~2가지 (4) 다음 액션 한 가지.\n" +
      "이미지에 토큰·비밀번호·개인정보가 보이면 '민감정보 노출 가능'만 짚고 내용은 반복하지 마세요.\n\n";
    switch (kind) {
      case "github_snapshot":
        return (
          common +
          "제출 종류: GitHub 웹 UI 스냅샷으로 간주합니다. PR/이슈/브랜치/리뷰/체크 상태 등 화면에서 읽히는 맥락을 기준으로 피드백하세요."
        );
      case "code_snapshot":
        return (
          common +
          "제출 종류: 코드 에디터·디프·터미널 등 코드 스냅샷으로 간주합니다. 가독성, 위험한 패턴(하드코딩 시크릿 등), 테스트·PR 단위 제안을 중심으로 하세요."
        );
      case "erd":
        return (
          common +
          "제출 종류: ERD·스키치·설계도로 간주합니다. 엔티티 관계 명확성, 누락 가능성, 다음으로 명세에 적을 한 가지를 제안하세요."
        );
      default:
        return common + `제출 종류(kind): ${kind}. 일반 산출물로 피드백하세요.`;
    }
  }

  private extractAssistantText(raw: unknown): string | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const choices = o.choices;
    if (!Array.isArray(choices) || choices.length === 0) return null;
    const msg = (choices[0] as { message?: { content?: unknown } })?.message;
    const c = msg?.content;
    if (typeof c === "string") return c.trim() || null;
    if (Array.isArray(c)) {
      const parts = c
        .filter((p): p is { type?: string; text?: string } => p != null && typeof p === "object")
        .map((p) => (p.type === "text" && typeof p.text === "string" ? p.text : ""))
        .join("");
      const t = parts.trim();
      return t || null;
    }
    return null;
  }

  /**
   * OpenAI Chat Completions 비전 (`image_url` data URL).
   * 모델 기본 `gpt-4o-mini`(비전 지원). `OPENAI_BASE_URL`·조직/프로젝트 헤더는 웹 채팅과 동일 규칙.
   */
  async evaluateImage(input: {
    mime: string;
    base64: string;
    kind: string;
  }): Promise<{ text: string; model: string; promptVersion: string }> {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
      throw new Error("OPENAI_NOT_CONFIGURED");
    }
    const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const dataUrl = `data:${input.mime};base64,${input.base64}`;
    const userText = this.buildUserText(input.kind);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    };
    const openaiOrg = process.env.OPENAI_ORGANIZATION?.trim() || process.env.OPENAI_ORG_ID?.trim();
    const openaiProject =
      process.env.OPENAI_PROJECT_ID?.trim() || process.env.OPENAI_PROJECT?.trim();
    if (openaiOrg) headers["OpenAI-Organization"] = openaiOrg;
    if (openaiProject) headers["OpenAI-Project"] = openaiProject;

    const body = {
      model,
      max_tokens: 1024,
      temperature: 0.6,
      messages: [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: userText },
            { type: "image_url" as const, image_url: { url: dataUrl } }
          ]
        }
      ]
    };

    const attempt = async (): Promise<string> => {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      const raw: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg =
          raw && typeof raw === "object" && "error" in raw
            ? String((raw as { error?: { message?: string } }).error?.message ?? res.statusText)
            : res.statusText;
        throw new Error(errMsg || `openai ${res.status}`);
      }
      const text = this.extractAssistantText(raw);
      if (!text) {
        throw new Error("OPENAI_EMPTY_RESPONSE");
      }
      return text;
    };

    try {
      const text = await attempt();
      return { text, model, promptVersion: ARTIFACT_EVAL_PROMPT_VERSION };
    } catch (e1) {
      const m1 = e1 instanceof Error ? e1.message : String(e1);
      if (/429|rate limit/i.test(m1)) {
        this.logger.warn("OpenAI artifact eval 429, retry once after 2s");
        await new Promise((r) => setTimeout(r, 2000));
        const text = await attempt();
        return { text, model, promptVersion: ARTIFACT_EVAL_PROMPT_VERSION };
      }
      throw e1;
    }
  }
}
