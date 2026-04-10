import { Module } from "@nestjs/common";
import { WebhookController } from "./webhook.controller";
import { VfsController } from "./vfs.controller";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { VfsService } from "./vfs.service";
import { ReportService } from "./report.service";
import { EventPublisherStub } from "./event-publisher.stub";
import { EVENT_PUBLISHER } from "./event-publisher.interface";

@Module({
  controllers: [WebhookController, VfsController, ValidationController],
  providers: [
    ValidationService,
    VfsService,
    ReportService,
    // TODO: A(오케스트레이터) Redis 연동 후 EventPublisherStub → RedisEventPublisher로 교체
    // 교체 시 이 줄만 수정하면 됨: useClass: RedisEventPublisher
    { provide: EVENT_PUBLISHER, useClass: EventPublisherStub },
  ],
  exports: [ValidationService, VfsService, ReportService],
})
export class IntegrationModule {}
