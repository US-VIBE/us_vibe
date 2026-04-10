import type { IntegrationEventType } from "../../../specs/data-model/types";
import type { ValidationResult } from "./contract-gate-service";
import type { SpecConversionResult } from "./prompt-spec-types";
import type { PrReviewSnapshot } from "./pr-review-types";
import type { RetroReport } from "./retro-types";
import type { LearningSession } from "./session-types";

export type SprintCheckpoint = { id: string; label: string; done: boolean };

export type TimelineEntry = {
  id: string;
  type: IntegrationEventType;
  label: string;
  time: string;
};

function timeLabel(baseIso: string, stepIndex: number): string {
  const d = new Date(baseIso);
  if (Number.isNaN(d.getTime())) return "—:—";
  d.setMinutes(d.getMinutes() + stepIndex * 4);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/** 헤더 스프린트 체크포인트 — 명세·계약·PR·회고 완료 여부를 실제 상태와 동기화 */
export function buildSprintCheckpoints(p: {
  specApproved: boolean;
  contractApproved: boolean;
  prSnap: PrReviewSnapshot;
  retroReports: RetroReport[];
}): SprintCheckpoint[] {
  return [
    { id: "cp1", label: "요구사항 승인", done: p.specApproved },
    { id: "cp2", label: "API 계약 승인", done: p.contractApproved },
    { id: "cp3", label: "PR 리뷰 완료", done: p.prSnap.phase === "approved" },
    { id: "cp4", label: "회고 리포트 생성", done: p.retroReports.length > 0 }
  ];
}

/** 우측 DoD 타임라인 — 달성한 마일스톤만 순서대로 표시 (시간은 세션 기준 가상 타임스탬프) */
export function buildDodTimeline(p: {
  session: LearningSession;
  specConversion: SpecConversionResult | null;
  specApproved: boolean;
  prSnap: PrReviewSnapshot;
  validationResult: ValidationResult | null;
  contractApproved: boolean;
  retroReports: RetroReport[];
}): TimelineEntry[] {
  const { session, specConversion, specApproved, prSnap, validationResult, contractApproved, retroReports } =
    p;
  const out: TimelineEntry[] = [];
  let step = 0;

  const push = (type: IntegrationEventType, label: string) => {
    out.push({
      id: `ev-${out.length}-${type}`,
      type,
      label,
      time: timeLabel(session.createdAt, step++)
    });
  };

  if (specConversion) {
    push("CONTRACT_CHANGED", `Prompt→Spec 변환 완료 (v${specConversion.specVersion})`);
  }
  if (specApproved) {
    push(
      "VFS_APPROVED",
      specConversion
        ? `요구사항 명세 승인 (v${specConversion.specVersion})`
        : "요구사항 명세 승인"
    );
  }
  if (prSnap.phase !== "idle") {
    push(
      "PR_OPENED",
      prSnap.prNumber != null
        ? `PR #${prSnap.prNumber} 제출${prSnap.branch ? ` (${prSnap.branch})` : ""}`
        : "PR 제출됨"
    );
  }
  if (prSnap.phase === "open" && prSnap.revisionRound >= 2) {
    push("PR_UPDATED", `재검토 라운드 ${prSnap.revisionRound} · 코멘트 반영 검토`);
  }
  if (validationResult) {
    if (validationResult.passed) {
      push("VALIDATION_PASSED", "OpenAPI 계약 검증 통과 (린트·타입·계약)");
    } else {
      push("VALIDATION_FAILED", "OpenAPI 검증 실패 · YAML 수정 후 재검증");
    }
  }
  if (contractApproved) {
    push("VFS_SNAPSHOT_CREATED", "계약 게이트 승인 · API 계약 확정");
  }
  if (prSnap.phase === "approved" && prSnap.prNumber != null) {
    push("PR_MERGED", `PR #${prSnap.prNumber} 최종 승인`);
  }
  if (retroReports.length > 0) {
    const latest = retroReports[0];
    const when = new Date(latest.createdAt);
    const dateStr = Number.isNaN(when.getTime())
      ? ""
      : when.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    push(
      "CODE_DELTA_ANALYZED",
      `회고 리포트 ${retroReports.length}건${dateStr ? ` · 최근 ${dateStr}` : ""}`
    );
  }

  return out;
}
