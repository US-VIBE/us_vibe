import { GoogleGenerativeAI } from "@google/generative-ai";
import { Injectable, Logger } from "@nestjs/common";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_FALLBACK = "gemini-2.5-flash-lite";

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
    parts: (string | { inlineData: { data: string; mimeType: string } })[]
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.generateContent(parts);
    return res.response.text().trim();
  }

  /** Retries on transient Google capacity errors; returns last thrown error if all fail. */
  private async generateWithRetries(
    key: string,
    modelName: string,
    parts: (string | { inlineData: { data: string; mimeType: string } })[],
    backoffMs: number[]
  ): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
      try {
        return await this.generateOnce(key, modelName, parts);
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
      return await this.generateWithRetries(key, primary, [prompt], primaryBackoff);
    } catch (e) {
      if (
        primary !== fallback &&
        this.isTransientCapacityError(e)
      ) {
        this.logger.warn(
          `Sustained overload on ${primary}; trying fallback ${fallback}`
        );
        return await this.generateWithRetries(key, fallback, [prompt], [
          700,
          1800,
          4000
        ]);
      }
      throw e;
    }
  }

  async generateMultimodal(
    system: string,
    user: string,
    file: { buffer: Buffer; mimeType: string }
  ): Promise<string> {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      throw new Error("GEMINI_NOT_CONFIGURED");
    }
    const primary = this.resolveModelName();
    const prompt = `System:\n${system}\n\nUser:\n${user}`;
    const parts = [
      prompt,
      {
        inlineData: {
          data: file.buffer.toString("base64"),
          mimeType: file.mimeType
        }
      }
    ];

    return await this.generateWithRetries(key, primary, parts, [900, 2200, 5000]);
  }
}
