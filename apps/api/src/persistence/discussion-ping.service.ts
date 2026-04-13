import { Injectable } from "@nestjs/common";
import {
  WorkspacePersistenceService,
  type InAppNotificationRow
} from "./workspace-persistence.service";

export type DiscussionPingSkip = { kind: string; reason: string };

export type DiscussionPingResult = {
  inserted: InAppNotificationRow[];
  skipped: DiscussionPingSkip[];
};

/**
 * 워크스페이스 게이트·상태를 보고 `in_app_notification`에 논의/추가 요청 알림을 적재한다.
 * 프론트는 기존 GET in-app-notifications 폴링으로 받아 채팅에 주입할 수 있다.
 */
@Injectable()
export class DiscussionPingService {
  constructor(private readonly workspace: WorkspacePersistenceService) {}

  private cooldownMinutes(): number {
    const raw = process.env.DISCUSSION_PING_COOLDOWN_MINUTES?.trim();
    const n = raw ? Number(raw) : 45;
    if (!Number.isFinite(n) || n < 1) return 45;
    return Math.min(Math.floor(n), 24 * 60);
  }

  /**
   * 조건에 맞는 룰마다 알림을 생성한다. 동일 `kind`는 쿨다운 내 재생성하지 않는다(`force`면 쿨다운 무시).
   */
  evaluateSession(sessionId: string, options?: { force?: boolean }): DiscussionPingResult {
    const force = Boolean(options?.force);
    const cooldown = this.cooldownMinutes();
    const inserted: InAppNotificationRow[] = [];
    const skipped: DiscussionPingSkip[] = [];

    const tryInsert = (kind: string, title: string, body: string): void => {
      if (!force && this.workspace.hasRecentInAppNotification(sessionId, kind, cooldown)) {
        skipped.push({ kind, reason: "cooldown" });
        return;
      }
      inserted.push(
        this.workspace.appendInAppNotification({
          sessionId,
          kind,
          title,
          body
        })
      );
    };

    if (!this.workspace.isPromptSpecApproved(sessionId)) {
      tryInsert(
        "discussion_prompt_spec_pending",
        "Prompt→Spec 미승인",
        "스토리2에서 명세 초안을 확정·승인하지 않았습니다. PM·Senior와 범위·수용 기준을 채팅에서 정리해 주세요."
      );
    }

    const contract = this.workspace.getContractState(sessionId);
    if (!contract.contractApproved && contract.lastValidation && !contract.lastValidation.passed) {
      tryInsert(
        "discussion_contract_validation",
        "OpenAPI 계약 검증 실패",
        "계약 게이트에서 마지막 검증이 통과하지 않았습니다. 스키마·에러 포맷을 맞춘 뒤 다시 검증하고, 필요하면 QA·BE와 채팅에서 합의해 주세요."
      );
    }

    if (!contract.contractApproved && !contract.lastValidation) {
      tryInsert(
        "discussion_contract_not_validated",
        "계약 검증 전",
        "아직 OpenAPI 계약 검증 기록이 없습니다. 스토리4에서 YAML을 검증한 뒤 진행 상황을 맞춰 주세요."
      );
    }

    const pr = this.workspace.getPrSnapshot(sessionId);
    if (pr.phase === "open") {
      const pending = pr.comments.filter(
        (c) => c.status === "pending" || c.status === "needs_clarification"
      );
      if (pending.length > 0) {
        tryInsert(
          "discussion_pr_comments",
          "PR 코멘트 대응 필요",
          `PR 시뮬에 응답이 필요한 코멘트가 ${pending.length}건 있습니다. 스토리3에서 반영·답글 후 재요청해 주세요.`
        );
      }
    }

    const ps = this.workspace.getProjectState(sessionId);
    if (ps.openQuestions.length > 0) {
      const preview = ps.openQuestions.slice(0, 3).join(" · ");
      tryInsert(
        "discussion_open_questions",
        "미결 오픈 이슈",
        `프로젝트 상태에 열린 질문이 ${ps.openQuestions.length}건 있습니다(예: ${preview}). 채널에서 우선순위를 정해 주세요.`
      );
    }

    return { inserted, skipped };
  }
}
