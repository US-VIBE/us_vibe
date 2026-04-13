import {
  Controller,
  Post,
  Headers,
  Body,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  HttpCode,
  Inject,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import type { Request } from "express";
import { EVENT_PUBLISHER, IEventPublisher } from "./event-publisher.interface";
import type { IntegrationEvent, IntegrationEventType } from "../../../../specs/data-model/types";
import {
  WorkspacePersistenceService,
  type WebhookIngestAuditOutcome,
} from "../persistence/workspace-persistence.service";
import { CodeDeltaRunnerService } from "./code-delta-runner.service";
import { WebhookPrValidationService } from "./webhook-pr-validation.service";
import {
  isClientIpAllowed,
  parseWebhookAllowlistRules,
  resolveWebhookClientIp,
} from "./webhook-client-ip.util";

interface GitHubPrPayload {
  action: string;
  number: number;
  pull_request: {
    head: { sha: string; ref: string };
    user: { login: string };
    merged?: boolean;
  };
}

interface GitHubPushPayload {
  ref: string;
  after: string;
  before: string;
}

function envFlagTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

function singleHeader(v: string | string[] | undefined): string | null {
  if (v == null) {
    return null;
  }
  const s = Array.isArray(v) ? v[0] : v;
  const t = typeof s === "string" ? s.trim() : "";
  return t.length > 0 ? t : null;
}

@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly workspace: WorkspacePersistenceService,
    private readonly codeDeltaRunner: CodeDeltaRunnerService,
    private readonly prValidation: WebhookPrValidationService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
    const requireSig = envFlagTrue(process.env.GITHUB_WEBHOOK_REQUIRE_SIGNATURE);
    if (!this.webhookSecret && !requireSig) {
      this.logger.warn(
        "GITHUB_WEBHOOK_SECRET 환경변수가 설정되지 않았습니다. Webhook 서명 검증이 비활성화됩니다.",
      );
    }
  }

  @Post("github")
  @HttpCode(200)
  async handleGitHubWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signatureHeader: string | string[] | undefined,
    @Headers("x-github-event") eventHeader: string | string[] | undefined,
    @Headers("x-github-delivery") deliveryHeader: string | string[] | undefined,
    @Body() payload: GitHubPrPayload | GitHubPushPayload,
  ): Promise<{ received: boolean }> {
    const deliveryId = singleHeader(deliveryHeader);
    const eventName = singleHeader(eventHeader) ?? "unknown";
    const trustProxy = envFlagTrue(process.env.WEBHOOK_TRUST_PROXY);
    const clientIp = resolveWebhookClientIp(req as Request, trustProxy) ?? null;
    const auditBase = { deliveryId, eventName, clientIp };

    if (envFlagTrue(process.env.GITHUB_WEBHOOK_REQUIRE_SIGNATURE) && !this.webhookSecret) {
      this.tryWebhookAudit({
        ...auditBase,
        outcome: "rejected_signature",
        detail: "require_sig_without_secret",
      });
      throw new UnauthorizedException(
        "GITHUB_WEBHOOK_REQUIRE_SIGNATURE 가 켜져 있으면 GITHUB_WEBHOOK_SECRET 이 필요합니다.",
      );
    }

    const allowRaw =
      process.env.WEBHOOK_ALLOWLIST?.trim() ||
      process.env.WEBHOOK_ALLOWED_CIDRS?.trim() ||
      "";
    const ipRules = parseWebhookAllowlistRules(allowRaw);
    if (ipRules.length > 0) {
      const ip = clientIp;
      if (!ip || !isClientIpAllowed(ip, ipRules)) {
        this.logger.warn(`Webhook IP 거부: ${ip ?? "unknown"}`);
        this.tryWebhookAudit({
          ...auditBase,
          outcome: "rejected_ip",
          detail: ip ?? "no_resolved_ip",
        });
        throw new ForbiddenException("허용되지 않은 클라이언트입니다.");
      }
    }

    // HMAC-SHA256 서명 검증
    if (this.webhookSecret) {
      const rawBody = req.rawBody;
      if (!rawBody) {
        this.tryWebhookAudit({
          ...auditBase,
          outcome: "rejected_signature",
          detail: "missing_raw_body",
        });
        throw new UnauthorizedException("요청 본문을 읽을 수 없습니다.");
      }
      const signature = singleHeader(signatureHeader) ?? undefined;
      this.verifySignature(rawBody, signature, auditBase);
    }

    this.logger.log(`GitHub 이벤트 수신: ${eventName}`);

    // 이벤트 타입에 따라 라우팅
    if (eventName === "pull_request") {
      await this.handlePullRequest(payload as GitHubPrPayload);
    } else if (eventName === "push") {
      await this.handlePush(payload as GitHubPushPayload);
    } else {
      this.logger.debug(`지원하지 않는 이벤트 타입: ${eventName} — 무시합니다.`);
      this.tryWebhookAudit({
        ...auditBase,
        outcome: "ignored_event",
        detail: null,
      });
      return { received: true };
    }

    this.tryWebhookAudit({
      ...auditBase,
      outcome: "processed",
      detail: null,
    });
    return { received: true };
  }

  private ingestSessionId(): string {
    return process.env.INTEGRATION_WEBHOOK_SESSION_ID?.trim() || "github-ingest";
  }

  private tryWebhookAudit(p: {
    deliveryId: string | null;
    eventName: string;
    clientIp: string | null;
    outcome: WebhookIngestAuditOutcome;
    detail: string | null;
  }): void {
    try {
      this.workspace.appendWebhookIngestAudit({
        deliveryId: p.deliveryId,
        eventName: p.eventName || "unknown",
        clientIp: p.clientIp,
        ingestSessionId: this.ingestSessionId(),
        outcome: p.outcome,
        detail: p.detail,
      });
    } catch (e) {
      this.logger.warn(`webhook audit insert 실패: ${(e as Error).message}`);
    }
  }

  private verifySignature(
    rawBody: Buffer,
    signature: string | undefined,
    audit: { deliveryId: string | null; eventName: string; clientIp: string | null },
  ): void {
    if (!signature) {
      this.tryWebhookAudit({
        ...audit,
        outcome: "rejected_signature",
        detail: "missing_signature_header",
      });
      throw new UnauthorizedException("X-Hub-Signature-256 헤더가 없습니다.");
    }
    const expectedSig =
      "sha256=" +
      createHmac("sha256", this.webhookSecret)
        .update(rawBody)
        .digest("hex");

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      this.logger.warn("Webhook 서명 불일치 — 요청 거부");
      this.tryWebhookAudit({
        ...audit,
        outcome: "rejected_signature",
        detail: "hmac_mismatch",
      });
      throw new UnauthorizedException("서명 검증 실패");
    }
  }

  private async handlePullRequest(payload: GitHubPrPayload): Promise<void> {
    const { action, number: prNumber, pull_request } = payload;
    const commitSha = pull_request.head.sha;
    const branch = pull_request.head.ref;
    const author = pull_request.user.login;

    let eventType: IntegrationEventType;

    if (action === "opened") {
      eventType = "PR_OPENED";
    } else if (action === "synchronize") {
      eventType = "PR_UPDATED";
    } else if (action === "closed" && Boolean(pull_request.merged)) {
      this.workspace.resetPrValidationStreak(prNumber);
      eventType = "PR_MERGED";
      await this.publishEvent(eventType, { prNumber, branch, author });
      return;
    } else {
      this.logger.debug(`PR 액션 무시: ${action}`);
      return;
    }

    if (action === "opened") {
      this.workspace.resetPrValidationStreak(prNumber);
    }

    this.logger.log(`정적 검증 시작: PR #${prNumber} (${eventType})`);
    await this.publishEvent(eventType, { prNumber, branch, author });

    await this.prValidation.scheduleOrRunValidation(prNumber, commitSha);
  }

  private async handlePush(payload: GitHubPushPayload): Promise<void> {
    const commitSha = payload.after;
    const beforeSha = payload.before ?? "";
    this.logger.log(`코드 커밋 감지: ${commitSha}`);
    const codeDeltaSummary = this.codeDeltaRunner.runForPush(beforeSha, commitSha);
    await this.publishEvent("CODE_DELTA_ANALYZED", { codeDeltaSummary });
    const sessionId = this.ingestSessionId();
    this.workspace.patchProjectStateCodeDelta(sessionId, codeDeltaSummary);
  }

  private async publishEvent(
    type: IntegrationEventType,
    payload: IntegrationEvent["payload"],
  ): Promise<void> {
    const sessionId = this.ingestSessionId();
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
