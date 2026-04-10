import { Injectable, Logger } from "@nestjs/common";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import type { IEventPublisher } from "./event-publisher.interface";

// TODO: A(오케스트레이터) Redis 연동 후 이 stub을 RedisEventPublisher로 교체한다.
// 교체 방법: integration.module.ts에서 useClass: EventPublisherStub → useClass: RedisEventPublisher
// Redis 채널: integration:events (docs/integration-sandbox/collaboration-interface.md 5-A항 참조)
@Injectable()
export class EventPublisherStub implements IEventPublisher {
  private readonly logger = new Logger(EventPublisherStub.name);

  async publish(event: IntegrationEvent): Promise<void> {
    this.logger.log(
      `[stub] type=${event.type} sessionId=${event.sessionId} stateVersion=${event.stateVersion} triggeredBy=${event.triggeredBy}`,
    );
    this.logger.debug(JSON.stringify(event.payload));
  }
}
