import { Controller, Get, Param, Logger, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { PrValidationStatusEnvelope } from "../persistence/workspace-persistence.service";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import type { RedisReplayQueueSnapshot } from "./integration-redis-replay-queue.service";
import { IntegrationRedisReplayQueueService } from "./integration-redis-replay-queue.service";
import { WebhookPrValidationService, QueueStatusInfo } from "./webhook-pr-validation.service";

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  code?: string;
  message?: string;
}

@Controller("api/validation")
@UseGuards(JwtAuthGuard)
export class ValidationController {
  private readonly logger = new Logger(ValidationController.name);

  constructor(
    private readonly workspace: WorkspacePersistenceService,
    private readonly prValidationService: WebhookPrValidationService,
    private readonly redisReplayQueue: IntegrationRedisReplayQueueService,
  ) {}

  @Get("status/:prNumber")
  async getStatus(
    @Param("prNumber") prNumber: string,
  ): Promise<ApiResponse<PrValidationStatusEnvelope | null>> {
    const n = parseInt(prNumber, 10);
    if (Number.isNaN(n)) {
      return { ok: true, data: null };
    }
    const env = this.workspace.getPrValidationStatusEnvelope(n);
    if (!env.validation) {
      this.logger.log(`PR #${prNumber} 검증 캐시 없음 (streak=${env.consecutiveFailures})`);
    }
    return { ok: true, data: env };
  }

  /**
   * BullMQ 큐 상태 조회 (P-1 관측성)
   * GET /api/validation/queue-status
   */
  @Get("queue-status")
  async getQueueStatus(): Promise<
    ApiResponse<
      QueueStatusInfo & {
        localMetrics: { jobsCompleted: number; jobsFailed: number; lastJobDurationMs: number };
        redisReplayQueue: RedisReplayQueueSnapshot;
      }
    >
  > {
    const status = await this.prValidationService.getQueueStatus();
    const localMetrics = this.prValidationService.getLocalMetrics();
    const redisReplayQueue = await this.redisReplayQueue.getQueueSnapshot();
    return {
      ok: true,
      data: { ...status, localMetrics, redisReplayQueue },
    };
  }
}
