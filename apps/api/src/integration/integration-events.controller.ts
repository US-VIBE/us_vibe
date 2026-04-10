import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

/** 통합 이벤트 스트림 조회 (폴링·디버깅·다른 서비스 BFF) */
@Controller("api/integration")
@UseGuards(JwtAuthGuard)
export class IntegrationEventsController {
  constructor(private readonly workspace: WorkspacePersistenceService) {}

  @Get("events")
  list(
    @Query("sessionId") sessionId?: string,
    @Query("limit") limit?: string
  ): { ok: true; data: { events: IntegrationEvent[] } } {
    const n = parseInt(limit ?? "50", 10);
    const events = this.workspace.listIntegrationEvents(sessionId?.trim() || undefined, n);
    return { ok: true, data: { events } };
  }
}
