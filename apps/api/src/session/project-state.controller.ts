import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { ProjectStateRecord } from "../persistence/workspace-persistence.service";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

/** 설계 §33 SSOT — 워크스페이스 SQLite 영속 */
@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class ProjectStateController {
  constructor(private readonly workspace: WorkspacePersistenceService) {}

  @Get(":sessionId/project-state")
  getState(@Param("sessionId") sessionId: string) {
    return { ok: true, data: this.workspace.getProjectState(sessionId) };
  }

  @Patch(":sessionId/project-state")
  patchState(
    @Param("sessionId") sessionId: string,
    @Body()
    body: {
      expectedVersion?: number;
      approvedRequirements?: string[];
      currentApiSpecs?: string[];
      rejectedDecisions?: string[];
      openQuestions?: string[];
      activeSprintGoal?: string | null;
    }
  ) {
    const cur = this.workspace.getProjectState(sessionId);
    const next: ProjectStateRecord = {
      stateVersion: cur.stateVersion,
      approvedRequirements:
        body.approvedRequirements !== undefined
          ? [...body.approvedRequirements]
          : [...cur.approvedRequirements],
      currentApiSpecs:
        body.currentApiSpecs !== undefined ? [...body.currentApiSpecs] : [...cur.currentApiSpecs],
      rejectedDecisions:
        body.rejectedDecisions !== undefined
          ? [...body.rejectedDecisions]
          : [...cur.rejectedDecisions],
      openQuestions:
        body.openQuestions !== undefined ? [...body.openQuestions] : [...cur.openQuestions],
      activeSprintGoal:
        body.activeSprintGoal !== undefined ? body.activeSprintGoal : cur.activeSprintGoal
    };
    if (body.expectedVersion != null && body.expectedVersion !== cur.stateVersion) {
      return {
        ok: false,
        code: "VERSION_CONFLICT",
        message: "stateVersion 불일치 — 최신 project-state를 다시 읽어 주세요."
      };
    }
    next.stateVersion = cur.stateVersion + 1;
    const r = this.workspace.saveProjectState(sessionId, next);
    if (!r.ok) {
      return { ok: false, code: r.code, message: "저장 실패" };
    }
    return { ok: true, data: next };
  }
}
