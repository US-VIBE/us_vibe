import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/authed-request";
import { randomUUID } from "crypto";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { EVENT_PUBLISHER, IEventPublisher } from "../integration/event-publisher.interface";
import {
  type RetroReport,
  WorkspacePersistenceService
} from "../persistence/workspace-persistence.service";
import {
  buildKpiBasisSummary,
  buildRetroKpiEvidence,
  computeRetroKpisFromEvents
} from "./retro-kpi.util";

@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class RetroController {
  constructor(
    private readonly workspace: WorkspacePersistenceService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher
  ) {}

  @Get(":sessionId/retro/reports")
  list(@Param("sessionId") sessionId: string, @Req() req: AuthedRequest) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const reports = [...this.workspace.getRetroReports(sessionId)].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return { ok: true, data: { reports } };
  }

  /** 저장 없이 최근 통합 이벤트로 KPI·근거 미리보기 */
  @Get(":sessionId/retro/kpi-preview")
  kpiPreview(
    @Param("sessionId") sessionId: string,
    @Req() req: AuthedRequest,
    @Query("limit") limit?: string
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const n = Math.min(Math.max(parseInt(limit ?? "400", 10) || 400, 1), 500);
    const events = this.workspace.listIntegrationEvents(sessionId, n);
    const kpis = computeRetroKpisFromEvents(events);
    const kpiBasis = buildKpiBasisSummary(events);
    const kpiEvidence = buildRetroKpiEvidence(events);
    return { ok: true, data: { kpis, kpiBasis, kpiEvidence } };
  }

  @Post(":sessionId/retro/generate")
  async generate(
    @Param("sessionId") sessionId: string,
    @Body() _body: Record<string, unknown>,
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const list = [...this.workspace.getRetroReports(sessionId)];
    const events = this.workspace.listIntegrationEvents(sessionId, 400);
    const kpis = computeRetroKpisFromEvents(events);
    const kpiBasis = buildKpiBasisSummary(events);
    const kpiEvidence = buildRetroKpiEvidence(events);
    const report: RetroReport = {
      id: randomUUID(),
      sessionId,
      createdAt: new Date().toISOString(),
      kpis,
      kpiBasis,
      kpiEvidence,
      nextActions: [
        "[API] 다음 스프린트: 계약 diff 알림을 킥오프 직후 공유",
        "[API] PR 코멘트에 우선순위 라벨 도입",
        "[API] OpenAPI 검증 실패 시 실패 체크 요약 상단 고정"
      ]
    };
    list.unshift(report);
    this.workspace.saveRetroReports(sessionId, list, req.user.sub);
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
