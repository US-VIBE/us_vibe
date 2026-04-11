import type { ValidationResult } from "./contract-gate-service";
import type { SpecConversionResult } from "./prompt-spec-types";
import type { PrReviewSnapshot } from "./pr-review-types";
import type { RoleGapSnapshot } from "./role-gap-types";
import type { LearningSession } from "./session-types";
import type { StoryTabId } from "./workspace-types";
import { isValidationPassing } from "./contract-gate-service";

const STORY_LABEL: Record<StoryTabId, string> = {
  s1: "스토리1 역할·게이트",
  s2: "스토리2 Prompt→Spec",
  s3: "스토리3 PR",
  s4: "스토리4 계약",
  s5: "스토리5 회고",
  s6: "연동 CI/이벤트"
};

function trunc(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type ThinkingR1Input = {
  session: LearningSession;
  gapLoading: boolean;
  roleGap: RoleGapSnapshot | null;
  gapError: string | null;
  activeStory: StoryTabId;
  specApproved: boolean;
  specConversion: SpecConversionResult | null;
  convertLoading: boolean;
  approveLoading: boolean;
  prSnap: PrReviewSnapshot;
  contractApproved: boolean;
  validationResult: ValidationResult | null;
  contractBusy: string | null;
  retroReportsCount: number;
  chatSending: boolean;
  messagesLength: number;
};

/** 워크스페이스 스냅샷에서 R1 Thinking 줄을 생성 (고정 목업 대신 실제 진행 반영). */
export function buildThinkingR1Lines(p: ThinkingR1Input): string[] {
  const lines: string[] = [];
  const sid = p.session.sessionId.slice(0, 8);

  lines.push(
    `[R1] 세션 ${sid} · 주제「${trunc(p.session.topic, 36)}」· 스프린트 ${p.session.sprintDays}일`
  );

  if (p.gapLoading) {
    lines.push("[R1] 역할 결손 스냅샷 동기화 중…");
  } else if (p.gapError) {
    lines.push(`[R1] 역할 스냅샷 오류 — ${trunc(p.gapError, 56)}`);
  } else if (p.roleGap) {
    const agents = p.roleGap.injectedAgents.map((a) => a.role).join(", ");
    lines.push(
      `[R1] stateVersion=${p.roleGap.stateVersion} · 에이전트 ${p.roleGap.injectedAgents.length}명 (${trunc(agents, 40)})`
    );
  }

  lines.push(`[R1] 포커스 탭: ${STORY_LABEL[p.activeStory]}`);

  if (p.convertLoading) lines.push("[R1] Prompt→Spec: 명세 변환 요청 중…");
  else if (p.approveLoading) lines.push("[R1] Prompt→Spec: 승인 요청 중…");
  else if (p.specConversion && !p.specApproved) {
    lines.push(
      `[R1] 명세 v${p.specConversion.specVersion} 변환됨 — 승인하면 스토리3~5 잠금 해제`
    );
  } else if (p.specApproved && p.specConversion) {
    lines.push(`[R1] 명세 v${p.specConversion.specVersion} 승인됨 — PR·계약·회고 단계 진행 가능`);
  } else {
    lines.push("[R1] Prompt→Spec: 아직 변환·승인 전 — 스토리2에서 진행");
  }

  const pr = p.prSnap;
  if (!p.specApproved) {
    lines.push("[R1] PR: 명세 승인 전 — 스토리3 비활성");
  } else if (pr.phase === "idle") {
    lines.push("[R1] PR: 제출 대기(스토리3에서 PR 제출)");
  } else if (pr.phase === "open") {
    const pending = pr.comments.filter((c) => c.status === "pending").length;
    lines.push(
      `[R1] PR #${pr.prNumber ?? "?"} · 라운드 ${pr.revisionRound} · 코멘트 대기 ${pending}/${pr.comments.length}`
    );
  } else {
    lines.push(`[R1] PR #${pr.prNumber ?? "?"} 최종 승인 — 계약 게이트·회고로 이동 가능`);
  }

  if (!p.specApproved) {
    lines.push("[R1] 계약: 명세 승인 후 스토리4에서 검증");
  } else if (p.contractBusy) {
    lines.push(`[R1] 계약 게이트: 처리 중 (${p.contractBusy})`);
  } else if (p.contractApproved) {
    lines.push("[R1] OpenAPI 계약 승인됨");
  } else if (p.validationResult && !isValidationPassing(p.validationResult)) {
    lines.push("[R1] 계약 검증: 실패 항목 있음 — 수정 후 재검증·승인");
  } else if (p.validationResult?.passed) {
    lines.push("[R1] 계약 검증: 통과 — 승인 버튼으로 게이트 완료 가능");
  } else {
    lines.push("[R1] 계약: YAML 검증 실행 전 또는 결과 없음");
  }

  const retroN = p.retroReportsCount;
  lines.push(
    retroN > 0
      ? `[R1] 회고: ${retroN}건 저장됨 · 스토리5에서 KPI·다음 액션 확인`
      : "[R1] 회고: 리포트 없음 — 스토리5에서 생성"
  );

  if (p.chatSending) {
    lines.push("[R1] 채팅: 에이전트 응답 생성 중…");
  } else if (p.messagesLength > 0) {
    lines.push(`[R1] 채팅: ${p.messagesLength}개 메시지 (세션 맥락 유지)`);
  }

  return lines.slice(0, 10);
}
