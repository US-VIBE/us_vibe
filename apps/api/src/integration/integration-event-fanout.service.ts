import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventEmitter } from "events";
import Redis from "ioredis";

/**
 * Redis Pub/Sub 단일 구독 → SSE 다중 클라이언트 팬아웃.
 * REDIS_URL 없으면 하트비트만.
 */
@Injectable()
export class IntegrationEventFanoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationEventFanoutService.name);
  private readonly emitter = new EventEmitter();
  private subscriber: Redis | null = null;
  private channel = "integration:events";

  onModuleInit(): void {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      this.logger.log("Integration fanout: REDIS_URL 없음 — SSE는 heartbeat만");
      return;
    }
    this.channel = process.env.INTEGRATION_REDIS_CHANNEL?.trim() || "integration:events";
    this.subscriber = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    this.subscriber.on("error", (e) => this.logger.warn(`Redis subscriber: ${e.message}`));
    void this.subscriber
      .connect()
      .then(() => this.subscriber!.subscribe(this.channel))
      .then(() => this.logger.log(`Integration fanout subscribed: ${this.channel}`))
      .catch((e) => this.logger.warn(`Redis subscribe failed: ${(e as Error).message}`));
    this.subscriber.on("message", (_ch, message) => {
      this.emitter.emit("msg", message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => {});
      this.subscriber = null;
    }
    this.emitter.removeAllListeners();
  }

  /** 원문 JSON 문자열 (Redis publish 페이로드와 동일) */
  onMessage(cb: (raw: string) => void): () => void {
    this.emitter.on("msg", cb);
    return () => this.emitter.off("msg", cb);
  }

  hasRedis(): boolean {
    return this.subscriber != null;
  }
}
