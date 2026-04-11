import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import type { IntegrationEvent } from "../../../../specs/data-model/types";

/**
 * `REDIS_URL` + `INTEGRATION_REDIS_PUBLISHER=1` 일 때만 통합 이벤트를 Pub/Sub로 브로드캐스트.
 * JWT denylist과 동일 Redis 인스턴스를 써도 채널이 다르면 공존 가능.
 */
@Injectable()
export class IntegrationRedisPubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(IntegrationRedisPubSubService.name);
  private client: Redis | null = null;

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    const on =
      process.env.INTEGRATION_REDIS_PUBLISHER === "1" ||
      process.env.INTEGRATION_REDIS_PUBLISHER === "true";
    if (url && on) {
      this.client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
      this.logger.log("Integration Redis publisher enabled (INTEGRATION_REDIS_PUBLISHER)");
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.client = null;
    }
  }

  async publishResolved(event: IntegrationEvent): Promise<void> {
    if (!this.client) {
      return;
    }
    const channel =
      process.env.INTEGRATION_REDIS_CHANNEL?.trim() || "integration:events";
    try {
      if (this.client.status === "wait") {
        await this.client.connect();
      }
      await this.client.publish(channel, JSON.stringify(event));
    } catch (e) {
      this.logger.warn(`Redis publish skipped: ${(e as Error).message}`);
    }
  }
}
