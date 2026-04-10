import { getBackendPackageLabel, RevokedTokenStore } from "@us-vibe/backend";
import { Controller, Get } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";

@Controller()
export class AppController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly revokedTokens: RevokedTokenStore
  ) {}

  @Get("health")
  getHealth(): { ok: boolean; service: string } {
    return { ok: true, service: `us-vibe-api+${getBackendPackageLabel()}` };
  }

  @Get("health/db")
  async getHealthDb(): Promise<{ ok: boolean; database: "up" | "down" }> {
    try {
      await this.dataSource.query("SELECT 1");
      return { ok: true, database: "up" };
    } catch {
      return { ok: false, database: "down" };
    }
  }

  @Get("health/redis")
  async getHealthRedis(): Promise<{
    ok: boolean;
    redis: "disabled" | "up" | "down";
  }> {
    if (!this.revokedTokens.isConfigured()) {
      return { ok: true, redis: "disabled" };
    }
    const status = await this.revokedTokens.ping();
    return { ok: status === "up", redis: status };
  }
}
