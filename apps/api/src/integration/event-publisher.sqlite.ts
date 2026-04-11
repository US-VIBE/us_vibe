import { Injectable, Logger } from "@nestjs/common";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import type { IEventPublisher } from "./event-publisher.interface";
import { IntegrationTimelineBridgeService } from "./integration-timeline-bridge.service";

/**
 * 이벤트를 SQLite `integration_events`에 기록. Redis 등 외부 브로커 전 이 단계에서
 * 조회·감사·디버깅이 가능하다.
 */
@Injectable()
export class EventPublisherSqlite implements IEventPublisher {
  private readonly logger = new Logger(EventPublisherSqlite.name);

  constructor(
    private readonly workspace: WorkspacePersistenceService,
    private readonly timelineBridge: IntegrationTimelineBridgeService
  ) {}

  async publish(event: IntegrationEvent): Promise<void> {
    const r = this.workspace.appendIntegrationEvent(event);
    this.logger.log(
      `[publish] ${r.type} session=${r.sessionId} v=${r.stateVersion} by=${r.triggeredBy}`
    );
    await this.timelineBridge.mirrorIfApplicable(r);
  }
}
