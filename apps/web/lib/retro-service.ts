import { apiFetch } from "./api-fetch";
import type { LearningSession } from "./session-types";
import type { RetroReport } from "./retro-types";

function unwrap<T>(json: unknown): T | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok === true && o.data !== undefined) return o.data as T;
  return json as T;
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
    ]
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
 */
export async function generateRetroReport(session: LearningSession): Promise<RetroReport> {
  const base = apiBase();
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/retro/generate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({})
        }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrap<{ report: RetroReport }>(json);
        if (data?.report) return data.report;
      }
    } catch (e) {
      console.warn("[retro] generate API 실패, 목업", e);
    }
  }
  return mockGenerateReport(session);
}
