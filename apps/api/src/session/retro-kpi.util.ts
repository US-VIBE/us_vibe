import type { IntegrationEvent } from "../../../../specs/data-model/types";
import type {
  RetroKpi,
  RetroKpiCitation,
  RetroKpiEvidenceBlock
} from "../persistence/workspace-persistence.service";

/**
 * 설계 §27 R3: 점수는 로그 기반 규칙만 사용(LLM 주관 점수 없음).
 */
export function computeRetroKpisFromEvents(events: IntegrationEvent[]): RetroKpi {
  const fails = events.filter((e) => e.type === "VALIDATION_FAILED").length;
  const passes = events.filter((e) => e.type === "VALIDATION_PASSED").length;
  const loops = events.filter((e) => e.type === "VALIDATION_LOOP_DETECTED").length;
  const prUpdates = events.filter((e) => e.type === "PR_UPDATED").length;
  const merged = events.filter((e) => e.type === "PR_MERGED").length;
  const vfsOk = events.filter((e) => e.type === "VFS_APPROVED").length;

  const roleBalanceScore = clamp(35 + passes * 4 + vfsOk * 5 - fails * 3 - loops * 8, 0, 99);
  const reworkRatePercent = clamp(8 + fails * 6 + prUpdates * 2, 0, 95);
  const reviewReflectionPercent = clamp(45 + prUpdates * 5 + merged * 12, 0, 99);
  const communicationScore = clamp(40 + passes * 3 + merged * 10 - loops * 5, 0, 99);

  return {
    roleBalanceScore,
    reworkRatePercent,
    reviewReflectionPercent,
    communicationScore
  };
}

function shortEventNote(e: IntegrationEvent): string {
  const p =
    typeof e.payload === "object" && e.payload !== null
      ? (e.payload as Record<string, unknown>)
      : null;
  const pr = typeof p?.prNumber === "number" ? `PR #${p.prNumber}` : "";
  const by = e.triggeredBy ? ` · ${e.triggeredBy}` : "";
  return pr ? `${e.type} · ${pr}${by}` : `${e.type}${by}`;
}

function recentCitationsForTypes(
  events: IntegrationEvent[],
  types: string[],
  max: number
): RetroKpiCitation[] {
  const set = new Set(types);
  const sorted = [...events].sort(
    (a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || "")
  );
  const out: RetroKpiCitation[] = [];
  for (const e of sorted) {
    if (set.has(e.type) && out.length < max) {
      out.push({
        eventType: e.type,
        timestamp: e.timestamp,
        note: shortEventNote(e)
      });
    }
  }
  return out;
}

/** 지표별 요약·최근 이벤트 인용(규칙 기반, LLM 없음). */
export function buildRetroKpiEvidence(events: IntegrationEvent[]): RetroKpiEvidenceBlock[] {
  const fails = events.filter((e) => e.type === "VALIDATION_FAILED").length;
  const passes = events.filter((e) => e.type === "VALIDATION_PASSED").length;
  const loops = events.filter((e) => e.type === "VALIDATION_LOOP_DETECTED").length;
  const prUpdates = events.filter((e) => e.type === "PR_UPDATED").length;
  const merged = events.filter((e) => e.type === "PR_MERGED").length;
  const vfsOk = events.filter((e) => e.type === "VFS_APPROVED").length;
  const kpis = computeRetroKpisFromEvents(events);

  return [
    {
      key: "roleBalance",
      labelKo: "역할 균형",
      score: kpis.roleBalanceScore,
      unit: "/100",
      summary: `통과 ${passes}·실패 ${fails}·루프 ${loops}·VFS 승인 ${vfsOk} 건이 반영됩니다. (35 + 통과×4 + VFS×5 - 실패×3 - 루프×8, 0–99)`,
      citations: recentCitationsForTypes(
        events,
        ["VALIDATION_PASSED", "VALIDATION_FAILED", "VALIDATION_LOOP_DETECTED", "VFS_APPROVED"],
        6
      )
    },
    {
      key: "rework",
      labelKo: "재작업률",
      score: kpis.reworkRatePercent,
      unit: "%",
      summary: `검증 실패 ${fails}건·PR 갱신 ${prUpdates}건이 비율 상승 요인입니다. (8 + 실패×6 + PR갱신×2, 0–95%)`,
      citations: recentCitationsForTypes(events, ["VALIDATION_FAILED", "PR_UPDATED"], 6)
    },
    {
      key: "reviewReflection",
      labelKo: "리뷰 반영률",
      score: kpis.reviewReflectionPercent,
      unit: "%",
      summary: `PR 갱신 ${prUpdates}·머지 ${merged}가 반영 강도를 높입니다. (45 + PR갱신×5 + 머지×12, 0–99%)`,
      citations: recentCitationsForTypes(events, ["PR_UPDATED", "PR_MERGED", "PR_OPENED"], 6)
    },
    {
      key: "communication",
      labelKo: "커뮤니케이션",
      score: kpis.communicationScore,
      unit: "/100",
      summary: `통과 ${passes}·머지 ${merged}는 가산, 루프 ${loops}는 감점입니다. (40 + 통과×3 + 머지×10 - 루프×5, 0–99)`,
      citations: recentCitationsForTypes(
        events,
        ["VALIDATION_PASSED", "PR_MERGED", "VALIDATION_LOOP_DETECTED"],
        6
      )
    }
  ];
}

/** F-6: 회고 화면에 표시할 한 줄 근거(이벤트 타입 카운트 기반). */
export function buildKpiBasisSummary(events: IntegrationEvent[]): string {
  const fails = events.filter((e) => e.type === "VALIDATION_FAILED").length;
  const passes = events.filter((e) => e.type === "VALIDATION_PASSED").length;
  const loops = events.filter((e) => e.type === "VALIDATION_LOOP_DETECTED").length;
  const prUpdates = events.filter((e) => e.type === "PR_UPDATED").length;
  const merged = events.filter((e) => e.type === "PR_MERGED").length;
  const vfsOk = events.filter((e) => e.type === "VFS_APPROVED").length;
  return (
    `최근 통합 이벤트 ${events.length}건 기준 — 검증 통과 ${passes}·실패 ${fails}·루프 ${loops}·PR 갱신 ${prUpdates}·머지 ${merged}·VFS 승인 ${vfsOk} (규칙 기반 KPI)`
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
