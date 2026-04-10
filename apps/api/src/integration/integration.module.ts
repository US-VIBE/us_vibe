import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WebhookController } from "./webhook.controller";
import { VfsController } from "./vfs.controller";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { VfsService } from "./vfs.service";
import { ReportService } from "./report.service";
import { EventPublisherSqlite } from "./event-publisher.sqlite";
import { EVENT_PUBLISHER } from "./event-publisher.interface";
import { IntegrationEventsController } from "./integration-events.controller";

@Module({
  imports: [AuthModule],
  controllers: [WebhookController, VfsController, ValidationController, IntegrationEventsController],
  providers: [
    ValidationService,
    VfsService,
    ReportService,
    /** Redis 등으로 교체 시: { provide: EVENT_PUBLISHER, useClass: RedisEventPublisher } */
    { provide: EVENT_PUBLISHER, useClass: EventPublisherSqlite },
  ],
  exports: [ValidationService, VfsService, ReportService, EVENT_PUBLISHER],
})
export class IntegrationModule {}
