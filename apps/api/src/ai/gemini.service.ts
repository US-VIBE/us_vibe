import { GoogleGenerativeAI } from "@google/generative-ai";
import { Injectable, Logger } from "@nestjs/common";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_FALLBACK = "gemini-2.5-flash-lite";

/** 세션 산출물 AI 평가 프롬프트 버전 — 저장 시 evaluation_json에 기록 */
export const ARTIFACT_EVAL_PROMPT_VERSION = "artifact-eval-v1";

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  /** Google AI v1beta no longer serves bare 1.5 ids; remap so old .env keeps working. */
  private resolveModelName(): string {
    const raw = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
    const retired = new Set([
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro",
      "gemini-1.5-pro-latest"
    ]);
    if (retired.has(raw)) {
      this.logger.warn(
        `GEMINI_MODEL=${raw} is not available on the current API; using ${DEFAULT_MODEL}`
      );
      return DEFAULT_MODEL;
    }
    return raw;
  }

  private fallbackModelName(): string {
    return process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK;
  }

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }

  private isTransientCapacityError(e: unknown): boolean {
    const msg = e instanceof Error ? e.message : String(e);
    return /503|429|Service Unavailable|UNAVAILABLE|high demand|overloaded|Resource exhausted|try again later/i.test(
      msg
    );
  }

  private async generateOnce(
    key: string,
    modelName: string,
    prompt: string
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.generateContent(prompt);
    return res.response.text().trim();
  }

  private buildArtifactEvalUserPrompt(kind: string): string {
    const common =
      "당신은 시니어 개발자 겸 리뷰어입니다. 아래 이미지는 학습 시뮬레이션에서 제출된 산출물입니다.\n" +
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

  private async generateVisionOnce(
    key: string,
    modelName: string,
    userPrompt: string,
    mime: string,
    imageBase64: string
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.generateContent([
      { text: userPrompt },
      { inlineData: { mimeType: mime, data: imageBase64 } }
    ]);
    const text = res.response.text()?.trim() ?? "";
    if (!text) {
      throw new Error("GEMINI_EMPTY_VISION_RESPONSE");
    }
    return text;
  }

  private async generateVisionWithRetries(
    key: string,
    modelName: string,
    userPrompt: string,
    mime: string,
    imageBase64: string,
    backoffMs: number[]
  ): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
      try {
        return await this.generateVisionOnce(key, modelName, userPrompt, mime, imageBase64);
      } catch (e) {
        lastError = e;
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[vision ${modelName}] ${msg}`);
        if (!this.isTransientCapacityError(e) || attempt === backoffMs.length) {
          throw e;
        }
        const wait = backoffMs[attempt] ?? 8000;
        this.logger.warn(
          `Gemini vision transient (${modelName} ${attempt + 1}/${backoffMs.length + 1}), wait ${wait}ms`
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastError;
  }

  /** Retries on transient Google capacity errors; returns last thrown error if all fail. */
  private async generateWithRetries(
    key: string,
    modelName: string,
    prompt: string,
    backoffMs: number[]
  ): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
      try {
        return await this.generateOnce(key, modelName, prompt);
      } catch (e) {
        lastError = e;
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[${modelName}] ${msg}`);
        if (!this.isTransientCapacityError(e) || attempt === backoffMs.length) {
          throw e;
        }
        const wait = backoffMs[attempt] ?? 8000;
        this.logger.warn(
          `Gemini transient error (${modelName} attempt ${attempt + 1}/${backoffMs.length + 1}), waiting ${wait}ms`
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastError;
  }

  async generateText(system: string, user: string): Promise<string> {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new Error("GEMINI_NOT_CONFIGURED");
    }
    const primary = this.resolveModelName();
    const fallback = this.fallbackModelName();
    const prompt = `System:\n${system}\n\nUser:\n${user}`;
    const primaryBackoff = [900, 2200, 5000, 8000];

    try {
      return await this.generateWithRetries(key, primary, prompt, primaryBackoff);
    } catch (e) {
      if (
        primary !== fallback &&
        this.isTransientCapacityError(e)
      ) {
        this.logger.warn(
          `Sustained overload on ${primary}; trying fallback ${fallback}`
        );
        return await this.generateWithRetries(key, fallback, prompt, [
          700,
          1800,
          4000
        ]);
      }
      throw e;
    }
  }

  /**
   * PNG/JPEG/WebP 인라인 이미지에 대한 짧은 리뷰 텍스트 (세션 산출물 평가).
   * PDF 등은 호출 전에 서비스 레이어에서 스킵할 것.
   */
  async evaluateArtifactImage(input: {
    mime: string;
    base64: string;
    kind: string;
  }): Promise<{ text: string; model: string; promptVersion: string }> {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new Error("GEMINI_NOT_CONFIGURED");
    }
    const userPrompt = this.buildArtifactEvalUserPrompt(input.kind);
    const primary = this.resolveModelName();
    const fallback = this.fallbackModelName();
    const primaryBackoff = [900, 2200, 5000];

    try {
      const text = await this.generateVisionWithRetries(
        key,
        primary,
        userPrompt,
        input.mime,
        input.base64,
        primaryBackoff
      );
      return { text, model: primary, promptVersion: ARTIFACT_EVAL_PROMPT_VERSION };
    } catch (e) {
      if (primary !== fallback && this.isTransientCapacityError(e)) {
        this.logger.warn(`Vision overload on ${primary}; trying ${fallback}`);
        const text = await this.generateVisionWithRetries(
          key,
          fallback,
          userPrompt,
          input.mime,
          input.base64,
          [700, 1800, 4000]
        );
        return { text, model: fallback, promptVersion: ARTIFACT_EVAL_PROMPT_VERSION };
      }
      throw e;
    }
  }
}
