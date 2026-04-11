import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { WebhookController } from "./webhook.controller";
import { VfsController } from "./vfs.controller";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { VfsService } from "./vfs.service";
import { ReportService } from "./report.service";
import { EventPublisherSqlite } from "./event-publisher.sqlite";
import { EVENT_PUBLISHER } from "./event-publisher.interface";
import { IntegrationEventsController } from "./integration-events.controller";
import { IntegrationTimelineBridgeService } from "./integration-timeline-bridge.service";
import { CodeDeltaRunnerService } from "./code-delta-runner.service";
import { IntegrationRedisPubSubService } from "./integration-redis-pubsub.service";

@Module({
  imports: [AuthModule, CollaborationModule],
  controllers: [WebhookController, VfsController, ValidationController, IntegrationEventsController],
  providers: [
    ValidationService,
    VfsService,
    ReportService,
    CodeDeltaRunnerService,
    IntegrationRedisPubSubService,
    IntegrationTimelineBridgeService,
    /** SQLite append + optional Redis Pub/Sub(INTEGRATION_REDIS_PUBLISHER) */
    { provide: EVENT_PUBLISHER, useClass: EventPublisherSqlite },
  ],
  exports: [ValidationService, VfsService, ReportService, EVENT_PUBLISHER],
})
export class IntegrationModule {}
