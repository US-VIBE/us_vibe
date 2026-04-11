import { Controller, Logger, MessageEvent, Sse, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Observable, Subject, fromEventPattern, interval, merge } from "rxjs";
import { map, takeUntil, finalize } from "rxjs/operators";
import { IntegrationEventFanoutService } from "./integration-event-fanout.service";

/**
 * Thought Stream / 실시간 통합 이벤트 — 브라우저는 Authorization 헤더가 가능한 fetch 스트리밍으로 소비.
 * @see docs/ai_협업_에이전트_설계 — §27 R1
 */
@Controller("api/integration")
@UseGuards(JwtAuthGuard)
export class IntegrationStreamController {
  private readonly logger = new Logger(IntegrationStreamController.name);

  constructor(private readonly fanout: IntegrationEventFanoutService) {}

  @Sse("stream")
  stream(): Observable<MessageEvent> {
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
      map((raw): MessageEvent => ({ data: raw }))
    );

    this.logger.debug("SSE subscription started (integration stream)");

    return merge(heartbeat, redisMsgs).pipe(
      finalize(() => {
        teardown.next();
        teardown.complete();
      })
    );
  }
}
