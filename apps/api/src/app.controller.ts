import { getBackendPackageLabel, RevokedTokenStore } from "@us-vibe/backend";
import { Controller, Get } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { SkipThrottle } from "@nestjs/throttler";
import type { DataSource } from "typeorm";

@SkipThrottle({ default: true })
@Controller()
export class AppController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly revokedTokens: RevokedTokenStore
  ) {}

  /** Some hosts probe `/` during bring-up; keep it cheap. */
  @Get()
  getRoot(): { ok: boolean } {
    return { ok: true };
  }

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

  /** S-2 운영 스모크: 시크릿 존재 여부·서명 모드·허용 목록 개수만 노출. `docs/collaboration-env-and-endpoints.md` 절 3.2. */
  @Get("health/webhook-security")
  getHealthWebhookSecurity(): {
    ok: true;
    github: {
      signatureVerification: "none" | "hmac_when_secret_configured" | "required";
      secretConfigured: boolean;
      allowlistRuleCount: number;
      trustProxyLikely: boolean;
    };
  } {
    const secretConfigured = Boolean(process.env.GITHUB_WEBHOOK_SECRET?.trim());
    const requireSig =
      process.env.GITHUB_WEBHOOK_REQUIRE_SIGNATURE?.trim().toLowerCase() === "1" ||
      process.env.GITHUB_WEBHOOK_REQUIRE_SIGNATURE?.trim().toLowerCase() === "true";
    let signatureVerification: "none" | "hmac_when_secret_configured" | "required";
    if (requireSig) {
      signatureVerification = "required";
    } else if (secretConfigured) {
      signatureVerification = "hmac_when_secret_configured";
    } else {
      signatureVerification = "none";
    }
    const allowRaw =
      process.env.WEBHOOK_ALLOWLIST?.trim() ||
      process.env.WEBHOOK_ALLOWED_CIDRS?.trim() ||
      "";
    const allowlistRuleCount = allowRaw
      ? allowRaw.split(",").map((s) => s.trim()).filter(Boolean).length
      : 0;
    const trustProxyLikely =
      process.env.WEBHOOK_TRUST_PROXY?.trim().toLowerCase() === "1" ||
      process.env.WEBHOOK_TRUST_PROXY?.trim().toLowerCase() === "true" ||
      Boolean(process.env.RAILWAY_ENVIRONMENT?.trim());
    return {
      ok: true,
      github: {
        signatureVerification,
        secretConfigured,
        allowlistRuleCount,
        trustProxyLikely
      }
    };
  }
}
