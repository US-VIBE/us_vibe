import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/authed-request";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import { SessionsService } from "../sessions/sessions.service";
import {
  filterIntegrationEventsForTimeline,
  filterPostgresTimelineUnknown,
  mergeUnifiedTimelineRows,
  parseCommaTokens,
  parseSortOrder,
  parseUnifiedTimelineSources,
  type UnifiedMergedRow
} from "./unified-timeline-merge.util";

function coercePostgresTimelineRows(
  rows: unknown[]
): Array<{ id: string; eventType: string; createdAt: string }> {
  const out: Array<{ id: string; eventType: string; createdAt: string }> = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") {
      continue;
    }
    const o = r as Record<string, unknown>;
    if (
      typeof o.id === "string" &&
      typeof o.eventType === "string" &&
      typeof o.createdAt === "string"
    ) {
      out.push({ id: o.id, eventType: o.eventType, createdAt: o.createdAt });
    }
  }
  return out;
}

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
    @Req() req: AuthedRequest,
    @Query("sessionId") sessionId?: string,
    @Query("limit") limit?: string
  ): { ok: true; data: { events: IntegrationEvent[] } } {
    const n = parseInt(limit ?? "50", 10);
    const sid = sessionId?.trim();
    if (sid) {
      this.workspace.assertWorkspaceSessionAccess(sid, req.user.sub);
    }
    const events = this.workspace.listIntegrationEvents(sid || undefined, n);
    return { ok: true, data: { events } };
  }

  /**
   * SQLite 통합 이벤트 + Postgres collaboration 타임라인을 한 응답으로 (세션 UUID일 때만 후자 조회).
   */
  @Get("unified-timeline")
  async unifiedTimeline(
    @Req() req: AuthedRequest,
    @Query("sessionId") sessionId?: string,
    @Query("limit") limit?: string,
    @Query("sortOrder") sortOrder?: string,
    @Query("sources") sources?: string,
    @Query("types") types?: string
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
      mergedTimeline: UnifiedMergedRow[];
    };
  }> {
    const sid = sessionId?.trim() ?? "";
    if (!sid) {
      return { ok: false, code: "BAD_REQUEST", message: "sessionId 쿼리가 필요합니다." };
    }
    this.workspace.assertWorkspaceSessionAccess(sid, req.user.sub);
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

    const typeTokens = parseCommaTokens(types);
    const sourceFilter = parseUnifiedTimelineSources(sources);
    let integrationEventsFiltered = filterIntegrationEventsForTimeline(
      integrationEvents,
      typeTokens
    );
    let postgresTimelineFiltered = filterPostgresTimelineUnknown(postgresTimeline, typeTokens);
    if (sourceFilter === "sqlite") {
      postgresTimelineFiltered = [];
    } else if (sourceFilter === "postgres") {
      integrationEventsFiltered = [];
    }
    const pgRows = coercePostgresTimelineRows(postgresTimelineFiltered);
    const mergedTimeline = mergeUnifiedTimelineRows(integrationEventsFiltered, pgRows, {
      sources: "both",
      typeTokens: [],
      sortOrder: parseSortOrder(sortOrder)
    });

    return {
      ok: true,
      data: {
        sessionId: sid,
        integrationEvents: integrationEventsFiltered,
        postgresTimeline: postgresTimelineFiltered,
        postgresNote,
        bridgeHint:
          "event-vocabulary-map: IntegrationEvent.sessionId가 UUID일 때만 collaboration_events로 브리지됩니다.",
        mergedTimeline
      }
    };
  }
}
