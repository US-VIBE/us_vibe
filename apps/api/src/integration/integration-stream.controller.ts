import {
  BadRequestException,
  Controller,
  Logger,
  MessageEvent,
  Query,
  Req,
  Sse,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/authed-request";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import { Observable, Subject, fromEventPattern, interval, merge } from "rxjs";
import { filter, map, takeUntil, finalize } from "rxjs/operators";
import { IntegrationEventFanoutService } from "./integration-event-fanout.service";

function redisPayloadMatchesSession(raw: string, sessionId: string): boolean {
  try {
    const j = JSON.parse(raw) as { sessionId?: unknown };
    return typeof j.sessionId === "string" && j.sessionId.trim() === sessionId;
  } catch {
    return false;
  }
}

/**
 * Thought Stream / 실시간 통합 이벤트 — 브라우저는 Authorization 헤더가 가능한 fetch 스트리밍으로 소비.
 * `sessionId` 쿼리 필수 — Redis 전역 채널 페이로드를 서버에서 세션 단위로 필터한다.
 * @see docs/ai_협업_에이전트_설계 — §27 R1
 */
@Controller("api/integration")
@UseGuards(JwtAuthGuard)
export class IntegrationStreamController {
  private readonly logger = new Logger(IntegrationStreamController.name);

  constructor(
    private readonly fanout: IntegrationEventFanoutService,
    private readonly workspace: WorkspacePersistenceService
  ) {}

  @Sse("stream")
  stream(
    @Req() req: AuthedRequest,
    @Query("sessionId") sessionIdRaw?: string
  ): Observable<MessageEvent> {
    const sessionId = sessionIdRaw?.trim() ?? "";
    if (!sessionId) {
      throw new BadRequestException({
        code: "SSE_SESSION_ID_REQUIRED",
        message: "sessionId query parameter is required"
      });
    }
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);

    const teardown = new Subject<void>();

    const heartbeat = interval(25000).pipe(
      takeUntil(teardown),
      map(
        (): MessageEvent => ({
          data: JSON.stringify({
            type: "heartbeat",
            redis: this.fanout.hasRedis(),
            t: new Date().toISOString()
          })
        })
      )
    );

    const redisMsgs = fromEventPattern<string>(
      (handler) => this.fanout.onMessage(handler),
      (_handler, remove: unknown) => {
        if (typeof remove === "function") {
          (remove as () => void)();
        }
      }
    ).pipe(
      takeUntil(teardown),
      filter((raw) => redisPayloadMatchesSession(raw, sessionId)),
      map((raw): MessageEvent => ({ data: raw }))
    );

    this.logger.debug(`SSE subscription started (integration stream) session=${sessionId}`);

    return merge(heartbeat, redisMsgs).pipe(
      finalize(() => {
        teardown.next();
        teardown.complete();
      })
    );
  }
}
