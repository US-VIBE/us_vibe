import { Injectable, Logger } from "@nestjs/common";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import type { IEventPublisher } from "./event-publisher.interface";

// 기본 구현은 `event-publisher.sqlite.ts`(SQLite 로그). Redis Pub/Sub는 이 클래스를
// `RedisEventPublisher`로 교체하며 integration.module에서 교체하면 된다.
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
