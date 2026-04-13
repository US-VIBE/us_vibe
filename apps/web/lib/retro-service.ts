import { apiFetch } from "./api-fetch";
import type { LearningSession } from "./session-types";
import type { RetroKpi, RetroKpiEvidenceBlock, RetroReport } from "./retro-types";

function unwrap<T>(json: unknown): T | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok === true && o.data !== undefined) return o.data as T;
  return json as T;
}

function failureMessageFromJson(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok === false) {
    if (typeof o.message === "string") return o.message;
    if (typeof o.code === "string") return o.code;
  }
  return null;
}

const apiBase = () => process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

function mockGenerateReport(session: LearningSession): RetroReport {
  const n = session.sessionId.replace(/-/g, "").slice(0, 8);
  const seed = parseInt(n, 16) % 97;
  return {
    id: crypto.randomUUID(),
    sessionId: session.sessionId,
    createdAt: new Date().toISOString(),
    kpis: {
      roleBalanceScore: 60 + (seed % 35),
      reworkRatePercent: 10 + (seed % 25),
      reviewReflectionPercent: 70 + (seed % 28),
      communicationScore: 55 + (seed % 40)
    },
    nextActions: [
      `다음 스프린트: 계약 변경 시 Gate B 직후 알림 (목표: ${session.topic.slice(0, 24) || "주제"} 관련)`,
      "PR 코멘트에 우선순위·담당 역할 라벨을 붙이기",
      "OpenAPI 검증 실패 시 실패한 체크(린트/타입/계약)만 상단에 고정 표시"
    ],
    kpiBasis: "목업: 통합 이벤트 스트림 없이 세션 id 시드로 KPI를 채웁니다."
  };
}

/**
 * GET /api/sessions/:sessionId/retro/reports
 */
export async function fetchRetroReports(session: LearningSession): Promise<RetroReport[]> {
  const base = apiBase();
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/retro/reports`,
        { credentials: "include", headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrap<{ reports: RetroReport[] }>(json);
        if (data?.reports && Array.isArray(data.reports)) return data.reports;
      }
    } catch (e) {
      console.warn("[retro] GET reports 실패, 로컬만 사용", e);
    }
  }
  return [];
}

/**
 * POST /api/sessions/:sessionId/retro/generate
 * API URL이 설정된 경우 실패 시 목업으로 숨기지 않고 오류를 던져 UI(`retroErr`)에 표시한다 (F-6).
 */
export async function generateRetroReport(session: LearningSession): Promise<RetroReport> {
  const base = apiBase();
  if (!base) {
    return mockGenerateReport(session);
  }
  const res = await apiFetch(
    `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/retro/generate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    }
  );
  const json: unknown = await res.json().catch(() => null);
  if (res.ok && json && typeof json === "object") {
    const fail = failureMessageFromJson(json);
    if (fail) {
      throw new Error(fail);
    }
    const data = unwrap<{ report: RetroReport }>(json);
    if (data?.report) {
      return data.report;
    }
  } else if (!res.ok) {
    const fromBody = json ? failureMessageFromJson(json) : null;
    throw new Error(fromBody ?? `retro/generate ${res.status}`);
  }
  throw new Error("서버 응답에 report가 없습니다.");
}

/** GET /api/sessions/:sessionId/retro/kpi-preview — 저장 없이 근거·인용 미리보기 */
export async function fetchRetroKpiPreview(session: LearningSession): Promise<{
  kpis: RetroKpi;
  kpiBasis: string;
  kpiEvidence: RetroKpiEvidenceBlock[];
}> {
  const base = apiBase();
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL이 없어 미리보기를 호출할 수 없습니다.");
  }
  const res = await apiFetch(
    `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/retro/kpi-preview`,
    { credentials: "include", headers: { Accept: "application/json" } }
  );
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(failureMessageFromJson(json) ?? `retro/kpi-preview ${res.status}`);
  }
  const data = unwrap<{ kpis: RetroKpi; kpiBasis: string; kpiEvidence: RetroKpiEvidenceBlock[] }>(
    json
  );
  if (!data?.kpis || !data.kpiEvidence) {
    throw new Error("kpi-preview 응답이 올바르지 않습니다.");
  }
  return data;
}
