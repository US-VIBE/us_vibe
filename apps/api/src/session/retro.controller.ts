import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { randomUUID } from "crypto";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { EVENT_PUBLISHER, IEventPublisher } from "../integration/event-publisher.interface";
import {
  type RetroReport,
  WorkspacePersistenceService
} from "../persistence/workspace-persistence.service";

@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class RetroController {
  constructor(
    private readonly workspace: WorkspacePersistenceService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher
  ) {}

  @Get(":sessionId/retro/reports")
  list(@Param("sessionId") sessionId: string) {
    const reports = [...this.workspace.getRetroReports(sessionId)].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return { ok: true, data: { reports } };
  }

  @Post(":sessionId/retro/generate")
  async generate(
    @Param("sessionId") sessionId: string,
    @Body() _body: Record<string, unknown>
  ) {
    const list = [...this.workspace.getRetroReports(sessionId)];
    const n = sessionId.replace(/-/g, "").slice(0, 8);
    const seed = parseInt(n, 16) % 97 || 1;
    const report: RetroReport = {
      id: randomUUID(),
      sessionId,
      createdAt: new Date().toISOString(),
      kpis: {
        roleBalanceScore: 60 + (seed % 35),
        reworkRatePercent: 10 + (seed % 25),
        reviewReflectionPercent: 70 + (seed % 28),
        communicationScore: 55 + (seed % 40)
      },
      nextActions: [
        "[API] 다음 스프린트: 계약 diff 알림을 킥오프 직후 공유",
        "[API] PR 코멘트에 우선순위 라벨 도입",
        "[API] OpenAPI 검증 실패 시 실패 체크 요약 상단 고정"
      ]
    };
    list.unshift(report);
    this.workspace.saveRetroReports(sessionId, list);
    const sv = this.workspace.getWorkspaceStateVersion(sessionId);
    const ev: IntegrationEvent = {
      type: "CODE_DELTA_ANALYZED",
      sessionId,
      stateVersion: sv,
      triggeredBy: "user",
      payload: {
        codeDeltaSummary: {
          commitSha: `retro-${report.id.slice(0, 8)}`,
          analyzedAt: report.createdAt,
          newEndpoints: [],
          modifiedEndpoints: [],
          removedEndpoints: [],
          dtoChanges: [],
          riskItems: [`retro_report:${report.id}`],
          contractChanged: false,
          changedFiles: []
        }
      },
      timestamp: new Date().toISOString()
    };
    await this.eventPublisher.publish(ev);
    return { ok: true, data: { report } };
  }
}
