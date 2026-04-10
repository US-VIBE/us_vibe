import { apiFetch } from "./api-fetch";
import type { LearningSession } from "./session-types";
import type {
  CommentReflectionStatus,
  PrReviewComment,
  PrReviewPhase,
  PrReviewSnapshot
} from "./pr-review-types";

function unwrap<T>(json: unknown): T | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok === true && o.data !== undefined) return o.data as T;
  return json as T;
}

export function createIdlePrSnapshot(sessionId: string): PrReviewSnapshot {
  return {
    sessionId,
    stateVersion: 1,
    prNumber: null,
    branch: null,
    revisionRound: 0,
    phase: "idle",
    comments: []
  };
}

function mockSubmitPr(session: LearningSession, prev: PrReviewSnapshot): PrReviewSnapshot {
  if (prev.phase !== "idle") return prev;
  const slug = session.topic.trim().slice(0, 32).replace(/\s+/g, "-") || "session";
  return {
    ...prev,
    stateVersion: prev.stateVersion + 1,
    prNumber: 12,
    branch: `feature/${slug}`,
    revisionRound: 1,
    phase: "open",
    comments: [
      {
        id: "c1",
        authorRole: "senior",
        authorLabel: "Senior",
        body: "에러 응답 스키마를 공통 DTO로 분리해 주세요.",
        status: "pending"
      },
      {
        id: "c2",
        authorRole: "fe",
        authorLabel: "FE",
        body: "OpenAPI example과 실제 응답 필드명이 일치하는지 확인 부탁드립니다.",
        status: "pending"
      }
    ]
  };
}

function allCommentsResolved(comments: PrReviewComment[]): boolean {
  return comments.length > 0 && comments.every((c) => c.status !== "pending");
}

function mockPatchComment(
  prev: PrReviewSnapshot,
  commentId: string,
  status: CommentReflectionStatus
): PrReviewSnapshot {
  return {
    ...prev,
    stateVersion: prev.stateVersion + 1,
    comments: prev.comments.map((c) => (c.id === commentId ? { ...c, status } : c))
  };
}

/** 라운드 1에서 모든 코멘트 반영 처리 후 재검토 → 라운드 2 코멘트 세트 */
function mockRequestReReview(session: LearningSession, prev: PrReviewSnapshot): PrReviewSnapshot {
  if (prev.revisionRound !== 1 || prev.phase !== "open") return prev;
  if (!allCommentsResolved(prev.comments)) return prev;
  return {
    ...prev,
    stateVersion: prev.stateVersion + 1,
    revisionRound: 2,
    phase: "open",
    comments: [
      {
        id: "c3",
        authorRole: "senior",
        authorLabel: "Senior",
        body: "1차 반영 확인했습니다. 401/403 계약 테스트 케이스를 추가해 주세요.",
        status: "pending"
      },
      {
        id: "c4",
        authorRole: "qa",
        authorLabel: "QA",
        body: "중복 가입 등 엣지 시나리오가 명세에 반영됐는지 검토 부탁드립니다.",
        status: "pending"
      }
    ]
  };
}

function mockFinalApprove(prev: PrReviewSnapshot): PrReviewSnapshot {
  if (prev.revisionRound < 2 || prev.phase !== "open") return prev;
  if (!allCommentsResolved(prev.comments)) return prev;
  return {
    ...prev,
    stateVersion: prev.stateVersion + 1,
    phase: "approved"
  };
}

const apiBase = () => process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

/**
 * GET /api/sessions/:sessionId/pr-review — API 미설정 시 null (로컬 persist 사용)
 */
export async function fetchPrReviewSnapshot(session: LearningSession): Promise<PrReviewSnapshot | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await apiFetch(
      `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/pr-review`,
      { credentials: "include", headers: { Accept: "application/json" } }
    );
    if (res.ok) {
      const json: unknown = await res.json();
      const data = unwrap<PrReviewSnapshot>(json);
      if (data && data.sessionId === session.sessionId) return data;
    }
  } catch (e) {
    console.warn("[pr-review] GET 실패", e);
  }
  return null;
}

/**
 * POST /api/sessions/:sessionId/pr-review/submit
 */
export async function submitPr(session: LearningSession, current: PrReviewSnapshot): Promise<PrReviewSnapshot> {
  const base = apiBase();
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/pr-review/submit`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ stateVersion: current.stateVersion })
        }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrap<PrReviewSnapshot>(json);
        if (data) return data;
      }
    } catch (e) {
      console.warn("[pr-review] submit API 실패, 목업", e);
    }
  }
  return mockSubmitPr(session, current);
}

/**
 * PATCH /api/sessions/:sessionId/pr-review/comments/:commentId
 */
export async function patchPrComment(
  session: LearningSession,
  current: PrReviewSnapshot,
  commentId: string,
  status: CommentReflectionStatus
): Promise<PrReviewSnapshot> {
  const base = apiBase();
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/pr-review/comments/${encodeURIComponent(commentId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ status, stateVersion: current.stateVersion })
        }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrap<PrReviewSnapshot>(json);
        if (data) return data;
      }
    } catch (e) {
      console.warn("[pr-review] PATCH 실패, 목업", e);
    }
  }
  return mockPatchComment(current, commentId, status);
}

/**
 * POST /api/sessions/:sessionId/pr-review/re-review
 */
export async function requestPrReReview(
  session: LearningSession,
  current: PrReviewSnapshot
): Promise<PrReviewSnapshot> {
  const base = apiBase();
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/pr-review/re-review`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ stateVersion: current.stateVersion })
        }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrap<PrReviewSnapshot>(json);
        if (data) return data;
      }
    } catch (e) {
      console.warn("[pr-review] re-review API 실패, 목업", e);
    }
  }
  return mockRequestReReview(session, current);
}

/**
 * POST /api/sessions/:sessionId/pr-review/final-approve
 */
export async function finalApprovePr(
  session: LearningSession,
  current: PrReviewSnapshot
): Promise<PrReviewSnapshot> {
  const base = apiBase();
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/pr-review/final-approve`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ stateVersion: current.stateVersion })
        }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrap<PrReviewSnapshot>(json);
        if (data) return data;
      }
    } catch (e) {
      console.warn("[pr-review] final-approve API 실패, 목업", e);
    }
  }
  return mockFinalApprove(current);
}
