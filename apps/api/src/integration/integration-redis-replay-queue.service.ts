import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Queue, Worker, type Job } from "bullmq";
import Redis from "ioredis";
import type { BullMQMetrics } from "./webhook-pr-validation.service";

const REDIS_REPLAY_QUEUE = "integration-redis-replay";

export type RedisReplayJobData = {
  channel: string;
  payload: string;
};

export type RedisReplayQueueSnapshot = {
  queueName: string;
  enqueueEnabled: boolean;
  metrics: BullMQMetrics | null;
};

function envFlagTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * Pub/Sub 직접 publish가 모두 실패했을 때 BullMQ로 비동기 재시도한다.
 * `INTEGRATION_BULLMQ=1` + `REDIS_URL` + `INTEGRATION_REDIS_REPLAY_QUEUE=1`일 때 API는 Queue만,
 * 워커 프로세스(`BULLMQ_PROCESS_ROLE=worker`)는 Worker만 기동한다 (별도 워커 모드와 동일 패턴).
 */
@Injectable()
export class IntegrationRedisReplayQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationRedisReplayQueueService.name);
  private shared: Redis | null = null;
  private queue: Queue<RedisReplayJobData> | null = null;
  private worker: Worker<RedisReplayJobData, void, string> | null = null;

  /** EventPublisher에서 실패 시 잡 적재 여부 */
  isReplayEnqueueEnabled(): boolean {
    return (
      envFlagTrue(process.env.INTEGRATION_BULLMQ) &&
      Boolean(process.env.REDIS_URL?.trim()) &&
      envFlagTrue(process.env.INTEGRATION_REDIS_REPLAY_QUEUE)
    );
  }

  async onModuleInit(): Promise<void> {
    if (!envFlagTrue(process.env.INTEGRATION_BULLMQ)) {
      return;
    }
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      return;
    }
    if (!envFlagTrue(process.env.INTEGRATION_REDIS_REPLAY_QUEUE)) {
      this.logger.log(
        "Redis replay queue 비활성화 (INTEGRATION_REDIS_REPLAY_QUEUE 미설정 시 Pub/Sub 실패만 로그)",
      );
      return;
    }

    const role = (process.env.BULLMQ_PROCESS_ROLE ?? "api").trim().toLowerCase();
    const separateWorker = envFlagTrue(process.env.INTEGRATION_BULLMQ_SEPARATE_WORKER);

    try {
      this.shared = new Redis(url, { maxRetriesPerRequest: null });

      const processor = async (job: Job<RedisReplayJobData>) => {
        const { channel, payload } = job.data;
        const pub = new Redis(url, { maxRetriesPerRequest: 10, lazyConnect: true });
        const maxAttempts = 5;
        const baseMs = 150;
        try {
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              if (pub.status === "wait") {
                await pub.connect();
              }
              await pub.publish(channel, payload);
              this.logger.log(
                `[redis-replay] published job=${job.id} channel=${channel} attempt=${attempt}/${maxAttempts}`,
              );
              return;
            } catch (e) {
              const msg = (e as Error).message;
              if (attempt >= maxAttempts) {
                this.logger.warn(
                  `[redis-replay] publish failed job=${job.id} channel=${channel}: ${msg}`,
                );
                throw e;
              }
              const delayMs = baseMs * 2 ** (attempt - 1);
              await this.sleepUnref(delayMs);
            }
          }
        } finally {
          await pub.quit().catch(() => {});
        }
      };

      if (role === "worker") {
        this.worker = new Worker<RedisReplayJobData>(REDIS_REPLAY_QUEUE, processor, {
          connection: this.shared,
          concurrency: 2,
        });
        this.worker.on("failed", (job, err) => {
          this.logger.error(
            `[redis-replay] job failed id=${job?.id ?? "?"}: ${(err as Error).message}`,
          );
        });
        this.logger.log(`[redis-replay] Worker 시작: ${REDIS_REPLAY_QUEUE}`);
        return;
      }

      if (role === "api") {
        this.queue = new Queue<RedisReplayJobData>(REDIS_REPLAY_QUEUE, {
          connection: this.shared.duplicate(),
        });
        this.logger.log(`[redis-replay] Queue 등록: ${REDIS_REPLAY_QUEUE}`);
      }

      if (!separateWorker) {
        this.worker = new Worker<RedisReplayJobData>(REDIS_REPLAY_QUEUE, processor, {
          connection: this.shared.duplicate(),
          concurrency: 2,
        });
        this.worker.on("failed", (job, err) => {
          this.logger.error(
            `[redis-replay] job failed id=${job?.id ?? "?"}: ${(err as Error).message}`,
          );
        });
        this.logger.log(`[redis-replay] Worker 시작(API 인라인): ${REDIS_REPLAY_QUEUE}`);
      }
    } catch (e) {
      this.logger.error(`[redis-replay] 초기화 실패: ${(e as Error).message}`);
      await this.cleanup();
    }
  }

  /** `GET /api/validation/queue-status` 등 관측용 */
  async getQueueSnapshot(): Promise<RedisReplayQueueSnapshot> {
    const enqueueEnabled = this.isReplayEnqueueEnabled();
    if (!enqueueEnabled || !this.queue) {
      return {
        queueName: REDIS_REPLAY_QUEUE,
        enqueueEnabled,
        metrics: null,
      };
    }
    try {
      const counts = await this.queue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      );
      return {
        queueName: REDIS_REPLAY_QUEUE,
        enqueueEnabled,
        metrics: {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          paused: counts.paused ?? 0,
        },
      };
    } catch (e) {
      this.logger.warn(`[redis-replay] 메트릭 조회 실패: ${(e as Error).message}`);
      return { queueName: REDIS_REPLAY_QUEUE, enqueueEnabled, metrics: null };
    }
  }

  async enqueueReplay(channel: string, payload: string): Promise<void> {
    if (!this.queue) {
      return;
    }
    const jobId = `redis-replay:${randomUUID()}`;
    await this.queue.add(
      "redis-publish-retry",
      { channel, payload },
      {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86_400 },
      },
    );
    this.logger.log(`[redis-replay] 잡 큐잉: ${jobId}`);
  }

  private async cleanup(): Promise<void> {
    await this.worker?.close();
    this.worker = null;
    await this.queue?.close();
    this.queue = null;
    if (this.shared) {
      await this.shared.quit().catch(() => {});
      this.shared = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.cleanup();
  }

  private sleepUnref(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      t.unref?.();
    });
  }
}
