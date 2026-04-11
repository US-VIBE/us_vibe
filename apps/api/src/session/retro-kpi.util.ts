import type { IntegrationEvent } from "../../../../specs/data-model/types";
import type { RetroKpi } from "../persistence/workspace-persistence.service";

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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
