import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { SessionsModule } from "../sessions/sessions.module";
import { WebhookController } from "./webhook.controller";
import { VfsController } from "./vfs.controller";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { VfsService } from "./vfs.service";
import { ReportService } from "./report.service";
import { EventPublisherSqlite } from "./event-publisher.sqlite";
import { EVENT_PUBLISHER } from "./event-publisher.interface";
import { IntegrationEventsController } from "./integration-events.controller";
import { IntegrationStreamController } from "./integration-stream.controller";
import { IntegrationEventFanoutService } from "./integration-event-fanout.service";
import { IntegrationTimelineBridgeService } from "./integration-timeline-bridge.service";
import { CodeDeltaRunnerService } from "./code-delta-runner.service";
import { IntegrationRedisPubSubService } from "./integration-redis-pubsub.service";
import { WebhookPrValidationService } from "./webhook-pr-validation.service";
import { OrchestrationQueueService } from "./orchestration-queue.service";

@Module({
  imports: [AuthModule, CollaborationModule, SessionsModule],
  controllers: [
    WebhookController,
    VfsController,
    ValidationController,
    IntegrationEventsController,
    IntegrationStreamController
  ],
  providers: [
    ValidationService,
    VfsService,
    ReportService,
    CodeDeltaRunnerService,
    IntegrationRedisPubSubService,
    WebhookPrValidationService,
    OrchestrationQueueService,
    IntegrationEventFanoutService,
    IntegrationTimelineBridgeService,
    /** SQLite append + optional Redis Pub/Sub(INTEGRATION_REDIS_PUBLISHER) */
    { provide: EVENT_PUBLISHER, useClass: EventPublisherSqlite },
  ],
  exports: [ValidationService, VfsService, ReportService, EVENT_PUBLISHER, OrchestrationQueueService],
})
export class IntegrationModule {}
