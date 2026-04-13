import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Queue, Worker, QueueEvents, Job } from "bullmq";
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
  sessionId: string;
}

/** BullMQ 큐 메트릭 (P-1 관측성) */
export interface BullMQMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/** 큐 상태 정보 (API 응답용) */
export interface QueueStatusInfo {
  enabled: boolean;
  connected: boolean;
  redisStatus: string;
  queueName: string;
  metrics: BullMQMetrics | null;
  memoryQueueLength: number;
  workerRunning: boolean;
  separateWorker: boolean;
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
  private bullQueueEvents: QueueEvents | null = null;
  private separateWorkerMode = false;

  // 메트릭 카운터 (인메모리 — 프로세스 재시작 시 초기화)
  private jobsCompleted = 0;
  private jobsFailed = 0;
  private lastJobDurationMs = 0;

  constructor(
    private readonly validationService: ValidationService,
    private readonly reportService: ReportService,
    private readonly workspace: WorkspacePersistenceService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!envFlagTrue(process.env.INTEGRATION_BULLMQ)) {
      this.logger.log("BullMQ 비활성화 (INTEGRATION_BULLMQ 미설정)");
      return;
    }
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      this.logger.warn(
        "INTEGRATION_BULLMQ=1 이지만 REDIS_URL 없음 — 인메모리 큐만 사용합니다.",
      );
      return;
    }

    const role = (process.env.BULLMQ_PROCESS_ROLE ?? "api").trim().toLowerCase();
    this.separateWorkerMode = envFlagTrue(process.env.INTEGRATION_BULLMQ_SEPARATE_WORKER);

    const runJob = async (job: Job<PrValidationJob>) => {
      const startTime = Date.now();
      const { prNumber, commitSha, sessionId } = job.data;
      this.logger.log(
        `[BullMQ] 잡 시작: id=${job.id} PR #${prNumber} commit=${commitSha.slice(0, 7)} attempt=${job.attemptsMade + 1}/${job.opts.attempts ?? 1}`,
      );
      try {
        await this.runQueuedValidation(prNumber, commitSha, sessionId);
        this.lastJobDurationMs = Date.now() - startTime;
        this.jobsCompleted++;
        this.logger.log(
          `[BullMQ] 잡 완료: id=${job.id} PR #${prNumber} duration=${this.lastJobDurationMs}ms`,
        );
      } catch (e) {
        this.lastJobDurationMs = Date.now() - startTime;
        this.jobsFailed++;
        this.logger.error(
          `[BullMQ] 잡 처리 오류: id=${job.id} PR #${prNumber} duration=${this.lastJobDurationMs}ms error=${(e as Error).message}`,
        );
        throw e;
      }
    };

    try {
      this.bullConnection = new Redis(url, { maxRetriesPerRequest: null });

      this.bullConnection.on("connect", () => {
        this.logger.log("[Redis] 연결됨");
      });
      this.bullConnection.on("ready", () => {
        this.logger.log("[Redis] 준비 완료");
      });
      this.bullConnection.on("error", (err) => {
        this.logger.error(`[Redis] 오류: ${err.message}`);
      });
      this.bullConnection.on("close", () => {
        this.logger.warn("[Redis] 연결 끊김");
      });
      this.bullConnection.on("reconnecting", () => {
        this.logger.log("[Redis] 재연결 중...");
      });

      if (role === "worker") {
        this.bullWorker = new Worker(BULL_QUEUE_NAME, runJob, {
          connection: this.bullConnection,
          concurrency: 1,
        });
        this.setupWorkerEventListeners(this.bullWorker, "worker");
        this.logger.log(
          `[BullMQ] 워커 전용 모드 시작: ${BULL_QUEUE_NAME} (npm run start:bullmq-worker)`,
        );
        return;
      }

      this.bullQueue = new Queue(BULL_QUEUE_NAME, {
        connection: this.bullConnection,
      });

      this.bullQueueEvents = new QueueEvents(BULL_QUEUE_NAME, {
        connection: new Redis(url, { maxRetriesPerRequest: null }),
      });
      this.setupQueueEventListeners(this.bullQueueEvents);

      if (!this.separateWorkerMode) {
        this.bullWorker = new Worker(BULL_QUEUE_NAME, runJob, {
          connection: this.bullConnection,
          concurrency: 1,
        });
        this.setupWorkerEventListeners(this.bullWorker, "api");
        this.logger.log(
          `[BullMQ] Queue + Worker 활성화: ${BULL_QUEUE_NAME}`,
        );
      } else {
        this.logger.log(
          `[BullMQ] Queue만 활성화 (${BULL_QUEUE_NAME}) — 워커는 별도 프로세스`,
        );
      }
    } catch (e) {
      this.logger.error(`[BullMQ] 초기화 실패: ${(e as Error).message}`);
      await this.cleanupBullResources();
    }
  }

  private setupWorkerEventListeners(worker: Worker, mode: string): void {
    worker.on("completed", (job) => {
      this.logger.log(`[BullMQ:${mode}] 잡 완료 이벤트: id=${job.id}`);
    });
    worker.on("failed", (job, err) => {
      const attemptsMade = job?.attemptsMade ?? 0;
      const maxAttempts = job?.opts?.attempts ?? 1;
      this.logger.error(
        `[BullMQ:${mode}] 잡 실패 이벤트: id=${job?.id ?? "?"} attempt=${attemptsMade}/${maxAttempts} error=${(err as Error).message}`,
      );
    });
    worker.on("stalled", (jobId) => {
      this.logger.warn(`[BullMQ:${mode}] 잡 stalled: id=${jobId}`);
    });
    worker.on("error", (err) => {
      this.logger.error(`[BullMQ:${mode}] 워커 오류: ${err.message}`);
    });
    worker.on("drained", () => {
      this.logger.debug(`[BullMQ:${mode}] 큐 비움`);
    });
  }

  private setupQueueEventListeners(queueEvents: QueueEvents): void {
    queueEvents.on("waiting", ({ jobId }) => {
      this.logger.debug(`[BullMQ:queue] 잡 대기 중: id=${jobId}`);
    });
    queueEvents.on("active", ({ jobId }) => {
      this.logger.debug(`[BullMQ:queue] 잡 활성화: id=${jobId}`);
    });
    queueEvents.on("completed", ({ jobId }) => {
      this.logger.log(`[BullMQ:queue] 잡 완료: id=${jobId}`);
    });
    queueEvents.on("failed", ({ jobId, failedReason }) => {
      this.logger.error(`[BullMQ:queue] 잡 실패: id=${jobId} reason=${failedReason}`);
    });
    queueEvents.on("stalled", ({ jobId }) => {
      this.logger.warn(`[BullMQ:queue] 잡 stalled: id=${jobId}`);
    });
    queueEvents.on("duplicated", ({ jobId }) => {
      this.logger.debug(`[BullMQ:queue] 중복 잡 감지: id=${jobId}`);
    });
  }

  private async cleanupBullResources(): Promise<void> {
    this.bullQueue = null;
    this.bullWorker = null;
    if (this.bullQueueEvents) {
      await this.bullQueueEvents.close().catch(() => {});
      this.bullQueueEvents = null;
    }
    if (this.bullConnection) {
      await this.bullConnection.quit().catch(() => {});
      this.bullConnection = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.bullWorker?.close();
    await this.bullQueue?.close();
    await this.bullQueueEvents?.close();
    if (this.bullConnection) {
      await this.bullConnection.quit().catch(() => {});
      this.bullConnection = null;
    }
  }

  async getQueueStatus(): Promise<QueueStatusInfo> {
    const enabled = envFlagTrue(process.env.INTEGRATION_BULLMQ);
    const connected = this.bullConnection?.status === "ready";
    const redisStatus = this.bullConnection?.status ?? "disconnected";

    let metrics: BullMQMetrics | null = null;
    if (this.bullQueue) {
      try {
        const counts = await this.bullQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
        metrics = {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          paused: counts.paused ?? 0,
        };
      } catch (e) {
        this.logger.warn(`[BullMQ] 메트릭 조회 실패: ${(e as Error).message}`);
      }
    }

    return {
      enabled,
      connected,
      redisStatus,
      queueName: BULL_QUEUE_NAME,
      metrics,
      memoryQueueLength: this.memoryQueue.length,
      workerRunning: this.bullWorker !== null,
      separateWorker: this.separateWorkerMode,
    };
  }

  getLocalMetrics(): { jobsCompleted: number; jobsFailed: number; lastJobDurationMs: number } {
    return {
      jobsCompleted: this.jobsCompleted,
      jobsFailed: this.jobsFailed,
      lastJobDurationMs: this.lastJobDurationMs,
    };
  }

  private webhookRaceMaxMs(): number {
    return Math.min(
      120_000,
      Math.max(5_000, Number(process.env.WEBHOOK_VALIDATION_MAX_MS ?? 28_000)),
    );
  }

  async scheduleOrRunValidation(
    prNumber: number,
    commitSha: string,
    sessionId: string
  ): Promise<void> {
    const streak = this.workspace.getValidationFailureStreak(prNumber);
    if (streak >= 5) {
      this.logger.warn(`PR #${prNumber} 검증 루프 상한(5회 연속 실패) — 정적 검증 스킵`);
      await this.publishEvent(
        "VALIDATION_LOOP_DETECTED",
        {
          prNumber,
          consecutiveFailures: streak,
        },
        sessionId
      );
      return;
    }

    if (envFlagTrue(process.env.WEBHOOK_VALIDATION_ASYNC)) {
      this.logger.log(`PR #${prNumber} 비동기 큐로 즉시 이관 (WEBHOOK_VALIDATION_ASYNC=1)`);
      this.enqueue({ prNumber, commitSha, sessionId });
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
      await this.finalizeValidation(prNumber, validationResult, sessionId);
    } catch (e) {
      if ((e as Error).message === "WEBHOOK_VALIDATION_TIMEOUT") {
        this.logger.warn(`PR #${prNumber} 정적 검증 타임아웃 (${maxMs}ms) — 큐로 이관`);
        this.enqueue({ prNumber, commitSha, sessionId });
        return;
      }
      throw e;
    }
  }

  private enqueue(job: PrValidationJob): void {
    if (this.bullQueue) {
      void this.enqueueBull(job).catch((err) => {
        this.logger.error(`[BullMQ] add 실패, 인메모리로 폴백: ${(err as Error).message}`);
        this.memoryQueue.push(job);
        void this.pumpMemoryQueue();
      });
      return;
    }
    this.memoryQueue.push(job);
    void this.pumpMemoryQueue();
  }

  private async enqueueBull(job: PrValidationJob): Promise<void> {
    if (!this.bullQueue) return;
    const jobId = `pr-validate:${job.sessionId}:${job.prNumber}:${job.commitSha}`;
    await this.bullQueue.add("pr-validate", job, {
      jobId,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
    this.logger.log(`[BullMQ] 잡 추가: id=${jobId} PR #${job.prNumber}`);
  }

  private async pumpMemoryQueue(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.memoryQueue.length > 0) {
        const job = this.memoryQueue.shift()!;
        await this.runQueuedValidation(job.prNumber, job.commitSha, job.sessionId);
      }
    } finally {
      this.pumping = false;
    }
  }

  private async runQueuedValidation(
    prNumber: number,
    commitSha: string,
    sessionId: string
  ): Promise<void> {
    const streak = this.workspace.getValidationFailureStreak(prNumber);
    if (streak >= 5) {
      this.logger.warn(`PR #${prNumber} (큐) 검증 루프 상한(5회 연속 실패) — 정적 검증 스킵`);
      await this.publishEvent(
        "VALIDATION_LOOP_DETECTED",
        {
          prNumber,
          consecutiveFailures: streak,
        },
        sessionId
      );
      return;
    }
    const validationResult = await this.validationService.runAll(prNumber, commitSha);
    await this.finalizeValidation(prNumber, validationResult, sessionId);
  }

  private async finalizeValidation(
    prNumber: number,
    validationResult: Awaited<ReturnType<ValidationService["runAll"]>>,
    sessionId: string
  ): Promise<void> {
    this.workspace.savePrValidationResult(prNumber, validationResult);
    const outcome = this.workspace.recordValidationOutcome(prNumber, validationResult.passed);
    if (outcome.loopJustDetected) {
      await this.publishEvent(
        "VALIDATION_LOOP_DETECTED",
        {
          prNumber,
          consecutiveFailures: outcome.streak,
        },
        sessionId
      );
    }

    if (validationResult.passed) {
      await this.publishEvent("VALIDATION_PASSED", { validationResult }, sessionId);
    } else {
      const fixGuide = LOGIN_MVP_PACK.prValidationFixGuide;
      await this.publishEvent(
        "VALIDATION_FAILED",
        {
          validationResult,
          fixRequestGuide: fixGuide,
        },
        sessionId
      );

      const repoOwner = process.env.GITHUB_REPO_OWNER ?? "";
      const repoName = process.env.GITHUB_REPO_NAME ?? "";
      if (repoOwner && repoName) {
        const body = this.reportService.buildValidationFailReport(
          validationResult,
          { preambleMarkdown: fixGuide },
        );
        await this.reportService.postPrComment(repoOwner, repoName, prNumber, body);
      }
    }
  }

  private async publishEvent(
    type: IntegrationEventType,
    payload: IntegrationEvent["payload"],
    sessionId: string
  ): Promise<void> {
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
