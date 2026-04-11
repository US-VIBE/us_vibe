import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import { SessionsService } from "../sessions/sessions.service";

/** 통합 이벤트 스트림 조회 (폴링·디버깅·다른 서비스 BFF) */
@Controller("api/integration")
@UseGuards(JwtAuthGuard)
export class IntegrationEventsController {
  constructor(
    private readonly workspace: WorkspacePersistenceService,
    private readonly sessions: SessionsService
  ) {}

  @Get("events")
  list(
    @Query("sessionId") sessionId?: string,
    @Query("limit") limit?: string
  ): { ok: true; data: { events: IntegrationEvent[] } } {
    const n = parseInt(limit ?? "50", 10);
    const events = this.workspace.listIntegrationEvents(sessionId?.trim() || undefined, n);
    return { ok: true, data: { events } };
  }

  /**
   * SQLite 통합 이벤트 + Postgres collaboration 타임라인을 한 응답으로 (세션 UUID일 때만 후자 조회).
   */
  @Get("unified-timeline")
  async unifiedTimeline(
    @Query("sessionId") sessionId?: string,
    @Query("limit") limit?: string
  ): Promise<{
    ok: boolean;
    code?: string;
    message?: string;
    data?: {
      sessionId: string;
      integrationEvents: IntegrationEvent[];
      postgresTimeline: unknown[];
      postgresNote: string | null;
      bridgeHint: string;
    };
  }> {
    const sid = sessionId?.trim() ?? "";
    if (!sid) {
      return { ok: false, code: "BAD_REQUEST", message: "sessionId 쿼리가 필요합니다." };
    }
    const n = parseInt(limit ?? "50", 10);
    const integrationEvents = this.workspace.listIntegrationEvents(sid, n);
    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sid);

    let postgresTimeline: unknown[] = [];
    let postgresNote: string | null = null;

    if (!uuidV4) {
      postgresNote =
        "sessionId가 UUID v4가 아니면 Postgres 타임라인을 조회하지 않습니다. INTEGRATION_WEBHOOK_SESSION_ID를 시뮬 세션 UUID로 맞추면 미러됩니다.";
    } else {
      try {
        postgresTimeline = await this.sessions.timeline(sid);
      } catch (e) {
        postgresNote =
          e instanceof Error ? e.message : "Postgres 세션을 찾을 수 없거나 타임라인 조회 실패";
      }
    }

    return {
      ok: true,
      data: {
        sessionId: sid,
        integrationEvents,
        postgresTimeline,
        postgresNote,
        bridgeHint:
          "event-vocabulary-map: IntegrationEvent.sessionId가 UUID일 때만 collaboration_events로 브리지됩니다."
      }
    };
  }
}
