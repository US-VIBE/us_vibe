/** 스토리3 PR 리뷰 — 설계 §25 AC (반영 상태·재검토·최종 승인) */

export type CommentReflectionStatus =
  | "pending"
  | "addressed"
  | "deferred"
  | "needs_clarification";

export interface PrReviewComment {
  id: string;
  authorRole: string;
  authorLabel: string;
  body: string;
  status: CommentReflectionStatus;
}

export type PrReviewPhase = "idle" | "open" | "approved";

export interface PrReviewSnapshot {
  sessionId: string;
  stateVersion: number;
  prNumber: number | null;
  branch: string | null;
  /** 0: 미제출, 1: 첫 PR, 2+: 재검토 라운드 */
  revisionRound: number;
  phase: PrReviewPhase;
  comments: PrReviewComment[];
}
