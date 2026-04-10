import type { PrReviewSnapshot } from "./pr-review-types";

const key = (sessionId: string) => `usvibe_pr_review_${sessionId}`;

export function loadPrReview(sessionId: string): PrReviewSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as PrReviewSnapshot;
  } catch {
    return null;
  }
}

export function savePrReview(sessionId: string, snapshot: PrReviewSnapshot): void {
  sessionStorage.setItem(key(sessionId), JSON.stringify(snapshot));
}

export function clearPrReview(sessionId: string): void {
  sessionStorage.removeItem(key(sessionId));
}
