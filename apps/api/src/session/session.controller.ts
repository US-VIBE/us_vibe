import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import { buildRoleGapPayload } from "./role-gap.util";

/**
 * 워크스페이스 세션 — role-gap, Prompt-to-Spec, 게이트 조회
 */
@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly workspace: WorkspacePersistenceService) {}

  @Get(":sessionId/role-gap")
  roleGap(@Param("sessionId") sessionId: string) {
    const profile = this.workspace.getSessionProfile(sessionId);
    return {
      ok: true,
      data: buildRoleGapPayload(sessionId, profile)
    };
  }

  @Patch(":sessionId/session-profile")
  patchSessionProfile(
    @Param("sessionId") sessionId: string,
    @Body() body: { humanRoleIds?: string[] }
  ) {
    const ids = Array.isArray(body?.humanRoleIds)
      ? body.humanRoleIds.map((x) => String(x).toLowerCase().trim()).filter(Boolean)
      : [];
    if (ids.length === 0) {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "humanRoleIds 배열이 필요합니다."
      };
    }
    const cur = this.workspace.getSessionProfile(sessionId);
    cur.humanRoleIds = ids;
    this.workspace.saveSessionProfile(sessionId, cur);
    return { ok: true, data: buildRoleGapPayload(sessionId, cur) };
  }

  @Get(":sessionId/workspace-gates")
  workspaceGates(@Param("sessionId") sessionId: string) {
    const contract = this.workspace.getContractState(sessionId);
    const prof = this.workspace.getSessionProfile(sessionId);
    const pr = this.workspace.getPrSnapshot(sessionId);
    return {
      ok: true,
      data: {
        promptSpecApproved: this.workspace.isPromptSpecApproved(sessionId),
        promptSpecApprovedVersion: prof.promptSpecApprovedVersion,
        contractValidatedPass: contract.lastValidation?.passed ?? false,
        contractApproved: contract.contractApproved,
        prPhase: pr.phase,
        prRevisionRound: pr.revisionRound
      }
    };
  }

  /** POST body: { promptText: string } */
  @Post(":sessionId/prompt-spec/convert")
  convertPrompt(
    @Param("sessionId") sessionId: string,
    @Body() body: { promptText?: string }
  ) {
    const promptText = typeof body?.promptText === "string" ? body.promptText : "";
    return {
      ok: true,
      data: {
        specVersion: 1,
        template: {
          goal: "학습자 요청을 수용 기준으로 구체화한다.",
          scope: promptText.slice(0, 400) + (promptText.length > 400 ? "…" : ""),
          constraints: "공통 에러 포맷 유지, 계약 게이트와 충돌 시 재검토.",
          acceptanceCriteria: [
            "요구 범위가 문장으로 명확히 구분된다.",
            "비목표가 최소 1개 이상 명시된다.",
            "완료 조건이 검증 가능한 형태다."
          ],
          nonGoals: ["프론트엔드 화면 구현", "성능 최적화 범위 확대"]
        },
        rawMarkdown: `# 요구사항 초안\n\n세션: ${sessionId}\n\n${promptText || "(빈 입력)"}`
      }
    };
  }

  /** POST body: { specVersion: number } — 승인 시 SQLite 프로필에 기록 (계약 게이트 선행 조건) */
  @Post(":sessionId/prompt-spec/approve")
  approveSpec(
    @Param("sessionId") sessionId: string,
    @Body() body: { specVersion?: number }
  ) {
    const specVersion = typeof body?.specVersion === "number" ? body.specVersion : 1;
    const prof = this.workspace.getSessionProfile(sessionId);
    prof.promptSpecApprovedVersion = specVersion;
    prof.promptSpecApprovedAt = new Date().toISOString();
    this.workspace.saveSessionProfile(sessionId, prof);
    return {
      ok: true,
      data: {
        status: "approved" as const,
        specVersion,
        approvedAt: prof.promptSpecApprovedAt
      }
    };
  }
}
