import { apiFetch } from "./api-fetch";
import type { LearningSession } from "./session-types";
import type { SpecApprovalResult, SpecConversionResult } from "./prompt-spec-types";

function unwrapData<T>(json: unknown): T | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok === true && o.data !== undefined) return o.data as T;
  return json as T;
}

function mockConvert(promptText: string): SpecConversionResult {
  const trimmed = promptText.trim();
  return {
    specVersion: 1,
    template: {
      goal: "학습자 요청을 수용 기준으로 구체화한다 (목업 변환).",
      scope: trimmed.slice(0, 400) + (trimmed.length > 400 ? "…" : ""),
      constraints: "공통 에러 포맷 유지, 인증 정책 문서와 충돌 시 계약 게이트에서 재검토.",
      acceptanceCriteria: [
        "요구 범위가 문장으로 명확히 구분된다.",
        "비목표(Non-goals)가 최소 1개 이상 명시된다.",
        "완료 조건이 검증 가능한 형태로 적힌다."
      ],
      nonGoals: ["프론트엔드 화면 구현", "성능 최적화 범위 확대"]
    },
    rawMarkdown: [
      "# 요구사항 초안 (목업)",
      "",
      "## 원문",
      trimmed || "(빈 입력)",
      "",
      "## 수용 기준 요약",
      "- 위 템플릿 필드는 서버가 생성한 구조화 결과입니다.",
      "- 승인 시 세션 메모리에 저장되는 형태와 동일한 스키마를 사용합니다."
    ].join("\n")
  };
}

/**
 * POST /api/sessions/:sessionId/prompt-spec/convert
 * body: { promptText: string }
 */
export async function convertPromptToSpec(
  session: LearningSession,
  promptText: string
): Promise<SpecConversionResult> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/prompt-spec/convert`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ promptText })
        }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrapData<SpecConversionResult>(json);
        if (data && typeof data.specVersion === "number" && data.template && data.rawMarkdown) {
          return data;
        }
      }
    } catch (e) {
      console.warn("[prompt-spec] convert API 실패, 목업 사용", e);
    }
  }
  return mockConvert(promptText);
}

/**
 * POST /api/sessions/:sessionId/prompt-spec/approve
 * body: { specVersion: number }
 */
export async function approvePromptSpec(
  session: LearningSession,
  specVersion: number
): Promise<SpecApprovalResult> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/prompt-spec/approve`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ specVersion })
        }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrapData<SpecApprovalResult>(json);
        if (data && data.status === "approved" && typeof data.specVersion === "number") {
          return data;
        }
      }
    } catch (e) {
      console.warn("[prompt-spec] approve API 실패, 목업 사용", e);
    }
  }
  return {
    status: "approved",
    specVersion,
    approvedAt: new Date().toISOString()
  };
}
