import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { ValidationService } from "./validation.service";
import { ReportService } from "./report.service";
import { EVENT_PUBLISHER, IEventPublisher } from "./event-publisher.interface";
import type { IntegrationEvent, IntegrationEventType } from "../../../../specs/data-model/types";
import { LOGIN_MVP_PACK } from "../scenarios/packs/login-mvp.pack";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

interface PrValidationJob {
  prNumber: number;
  commitSha: string;
}

const BULL_QUEUE_NAME = "integration-pr-validate";

function envFlagTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

@Injectable()
export class WebhookPrValidationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookPrValidationService.name);
  private readonly memoryQueue: PrValidationJob[] = [];
  private pumping = false;
  private bullConnection: Redis | null = null;
  private bullQueue: Queue | null = null;
  private bullWorker: Worker | null = null;

  constructor(
    private readonly validationService: ValidationService,
    private readonly reportService: ReportService,
    private readonly workspace: WorkspacePersistenceService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!envFlagTrue(process.env.INTEGRATION_BULLMQ)) {
      return;
    }
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      this.logger.warn(
        "INTEGRATION_BULLMQ=1 이지만 REDIS_URL 없음 — 인메모리 큐만 사용합니다.",
      );
      return;
    }
    try {
      this.bullConnection = new Redis(url, { maxRetriesPerRequest: null });
      this.bullQueue = new Queue(BULL_QUEUE_NAME, {
        connection: this.bullConnection,
      });
      this.bullWorker = new Worker(
        BULL_QUEUE_NAME,
        async (job) => {
          const { prNumber, commitSha } = job.data as PrValidationJob;
          await this.runQueuedValidation(prNumber, commitSha);
        },
        { connection: this.bullConnection, concurrency: 1 },
      );
      this.bullWorker.on("failed", (job, err) => {
        this.logger.error(
          `BullMQ job 실패 id=${job?.id ?? "?"}: ${(err as Error).message}`,
        );
      });
      this.logger.log(`BullMQ 큐 활성화: ${BULL_QUEUE_NAME}`);
    } catch (e) {
      this.logger.error(`BullMQ 초기화 실패: ${(e as Error).message}`);
      this.bullQueue = null;
      this.bullWorker = null;
      if (this.bullConnection) {
        await this.bullConnection.quit().catch(() => {});
        this.bullConnection = null;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.bullWorker?.close();
    await this.bullQueue?.close();
    if (this.bullConnection) {
      await this.bullConnection.quit().catch(() => {});
      this.bullConnection = null;
    }
  }

  private webhookRaceMaxMs(): number {
    return Math.min(
      120_000,
      Math.max(5_000, Number(process.env.WEBHOOK_VALIDATION_MAX_MS ?? 28_000)),
    );
  }

  /**
   * PR 이벤트 발행 이후 호출. 루프 가드·동기 레이스·비동기 큐·타임아웃 시 큐 이관.
   */
  async scheduleOrRunValidation(prNumber: number, commitSha: string): Promise<void> {
    const streak = this.workspace.getValidationFailureStreak(prNumber);
    if (streak >= 5) {
      this.logger.warn(
        `PR #${prNumber} 검증 루프 상한(5회 연속 실패) — 정적 검증 스킵`,
      );
      await this.publishEvent("VALIDATION_LOOP_DETECTED", {
        prNumber,
        consecutiveFailures: streak,
      });
      return;
    }

    if (envFlagTrue(process.env.WEBHOOK_VALIDATION_ASYNC)) {
      this.enqueue({ prNumber, commitSha });
      return;
    }

    const maxMs = this.webhookRaceMaxMs();
    try {
      const validationResult = await Promise.race([
        this.validationService.runAll(prNumber, commitSha),
        new Promise<never>((_, rej) => {
          const t = setTimeout(
            () => rej(new Error("WEBHOOK_VALIDATION_TIMEOUT")),
            maxMs,
          );
          t.unref?.();
        }),
      ]);
      await this.finalizeValidation(prNumber, validationResult);
    } catch (e) {
      if ((e as Error).message === "WEBHOOK_VALIDATION_TIMEOUT") {
        this.logger.warn(
          `PR #${prNumber} 정적 검증 타임아웃 (${maxMs}ms) — 큐로 이관`,
        );
        this.enqueue({ prNumber, commitSha });
        return;
      }
      throw e;
    }
  }

  private enqueue(job: PrValidationJob): void {
    if (this.bullQueue) {
      void this.enqueueBull(job).catch((err) => {
        this.logger.error(
          `BullMQ add 실패, 인메모리로 폴백: ${(err as Error).message}`,
        );
        this.memoryQueue.push(job);
        void this.pumpMemoryQueue();
      });
      return;
    }
    this.memoryQueue.push(job);
    void this.pumpMemoryQueue();
  }

  private async enqueueBull(job: PrValidationJob): Promise<void> {
    if (!this.bullQueue) {
      return;
    }
    await this.bullQueue.add("pr-validate", job, {
      jobId: `pr-validate:${job.prNumber}:${job.commitSha}`,
      removeOnComplete: { age: 3600 },
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
  }

  private async pumpMemoryQueue(): Promise<void> {
    if (this.pumping) {
      return;
    }
    this.pumping = true;
    try {
      while (this.memoryQueue.length > 0) {
        const job = this.memoryQueue.shift()!;
        await this.runQueuedValidation(job.prNumber, job.commitSha);
      }
    } finally {
      this.pumping = false;
    }
  }

  private async runQueuedValidation(
    prNumber: number,
    commitSha: string,
  ): Promise<void> {
    const streak = this.workspace.getValidationFailureStreak(prNumber);
    if (streak >= 5) {
      this.logger.warn(
        `PR #${prNumber} (큐) 검증 루프 상한(5회 연속 실패) — 정적 검증 스킵`,
      );
      await this.publishEvent("VALIDATION_LOOP_DETECTED", {
        prNumber,
        consecutiveFailures: streak,
      });
      return;
    }

    const validationResult = await this.validationService.runAll(
      prNumber,
      commitSha,
    );
    await this.finalizeValidation(prNumber, validationResult);
  }

  private async finalizeValidation(
    prNumber: number,
    validationResult: Awaited<ReturnType<ValidationService["runAll"]>>,
  ): Promise<void> {
    this.workspace.savePrValidationResult(prNumber, validationResult);
    const outcome = this.workspace.recordValidationOutcome(
      prNumber,
      validationResult.passed,
    );
    if (outcome.loopJustDetected) {
      await this.publishEvent("VALIDATION_LOOP_DETECTED", {
        prNumber,
        consecutiveFailures: outcome.streak,
      });
    }

    if (validationResult.passed) {
      await this.publishEvent("VALIDATION_PASSED", { validationResult });
    } else {
      const fixGuide = LOGIN_MVP_PACK.prValidationFixGuide;
      await this.publishEvent("VALIDATION_FAILED", {
        validationResult,
        fixRequestGuide: fixGuide,
      });

      const repoOwner = process.env.GITHUB_REPO_OWNER ?? "";
      const repoName = process.env.GITHUB_REPO_NAME ?? "";
      if (repoOwner && repoName) {
        const body = this.reportService.buildValidationFailReport(
          validationResult,
          { preambleMarkdown: fixGuide },
        );
        await this.reportService.postPrComment(
          repoOwner,
          repoName,
          prNumber,
          body,
        );
      }
    }
  }

  private async publishEvent(
    type: IntegrationEventType,
    payload: IntegrationEvent["payload"],
  ): Promise<void> {
    const sessionId =
      process.env.INTEGRATION_WEBHOOK_SESSION_ID?.trim() || "github-ingest";
    const event: IntegrationEvent = {
      type,
      sessionId,
      stateVersion: 0,
      triggeredBy: "github",
      payload,
      timestamp: new Date().toISOString(),
    };
    await this.eventPublisher.publish(event);
  }
}
