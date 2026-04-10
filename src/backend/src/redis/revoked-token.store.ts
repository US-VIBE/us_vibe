import Redis from "ioredis";

/**
 * JWT `jti` denylist using Redis SETEX. When `REDIS_URL` is unset, all methods
 * no-op so local development can proceed without Redis.
 */
export class RevokedTokenStore {
  private readonly client: Redis | null;

  constructor(redisUrl?: string) {
    this.client =
      redisUrl && redisUrl.trim().length > 0
        ? new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1
          })
        : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async ping(): Promise<"up" | "down"> {
    if (!this.client) {
      return "down";
    }
    try {
      const reply = await this.client.ping();
      return reply === "PONG" ? "up" : "down";
    } catch {
      return "down";
    }
  }

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (!this.client || ttlSeconds <= 0) {
      return;
    }
    const key = `revoked:jti:${jti}`;
    try {
      await this.client.setex(key, ttlSeconds, "1");
    } catch {
      // Intentionally swallow: logout should remain usable if Redis is down.
    }
  }

  async isRevoked(jti: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    const key = `revoked:jti:${jti}`;
    try {
      const value = await this.client.get(key);
      return value === "1";
    } catch {
      return false;
    }
  }
}
