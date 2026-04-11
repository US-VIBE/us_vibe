import {
  Controller,
  Post,
  Headers,
  Body,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  Logger,
  HttpCode,
  Inject,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import type { Request } from "express";
import { ValidationService } from "./validation.service";
import { ReportService } from "./report.service";
import { EVENT_PUBLISHER, IEventPublisher } from "./event-publisher.interface";
import type { IntegrationEvent, IntegrationEventType } from "../../../../specs/data-model/types";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import { CodeDeltaRunnerService } from "./code-delta-runner.service";

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

@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly validationService: ValidationService,
    private readonly reportService: ReportService,
    private readonly workspace: WorkspacePersistenceService,
    private readonly codeDeltaRunner: CodeDeltaRunnerService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
    if (!this.webhookSecret) {
      this.logger.warn(
        "GITHUB_WEBHOOK_SECRET 환경변수가 설정되지 않았습니다. Webhook 서명 검증이 비활성화됩니다.",
      );
    }
  }

  @Post("github")
  @HttpCode(200)
  async handleGitHubWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signature: string,
    @Headers("x-github-event") eventName: string,
    @Body() payload: GitHubPrPayload | GitHubPushPayload,
  ): Promise<{ received: boolean }> {
    // HMAC-SHA256 서명 검증
    if (this.webhookSecret) {
      const rawBody = req.rawBody;
      if (!rawBody) {
        throw new UnauthorizedException("요청 본문을 읽을 수 없습니다.");
      }
      this.verifySignature(rawBody, signature);
    }

    this.logger.log(`GitHub 이벤트 수신: ${eventName}`);

    // 이벤트 타입에 따라 라우팅
    if (eventName === "pull_request") {
      await this.handlePullRequest(payload as GitHubPrPayload);
    } else if (eventName === "push") {
      await this.handlePush(payload as GitHubPushPayload);
    } else {
      this.logger.debug(`지원하지 않는 이벤트 타입: ${eventName} — 무시합니다.`);
    }

    return { received: true };
  }

  private verifySignature(rawBody: Buffer, signature: string): void {
    if (!signature) {
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

    const streak = this.workspace.getValidationFailureStreak(prNumber);
    if (streak >= 5) {
      this.logger.warn(`PR #${prNumber} 검증 루프 상한(5회 연속 실패) — 정적 검증 스킵`);
      await this.publishEvent("VALIDATION_LOOP_DETECTED", {
        prNumber,
        consecutiveFailures: streak
      });
      return;
    }

    const maxMs = Math.min(
      120_000,
      Math.max(5_000, Number(process.env.WEBHOOK_VALIDATION_MAX_MS ?? 28_000))
    );
    let validationResult: Awaited<ReturnType<ValidationService["runAll"]>>;
    try {
      validationResult = await Promise.race([
        this.validationService.runAll(prNumber, commitSha),
        new Promise<never>((_, rej) => {
          const t = setTimeout(() => rej(new Error("WEBHOOK_VALIDATION_TIMEOUT")), maxMs);
          t.unref?.();
        })
      ]);
    } catch (e) {
      if ((e as Error).message === "WEBHOOK_VALIDATION_TIMEOUT") {
        this.logger.warn(`PR #${prNumber} 정적 검증 타임아웃 (${maxMs}ms) — 스킵`);
        return;
      }
      throw e;
    }

    this.workspace.savePrValidationResult(prNumber, validationResult);
    const outcome = this.workspace.recordValidationOutcome(prNumber, validationResult.passed);
    if (outcome.loopJustDetected) {
      await this.publishEvent("VALIDATION_LOOP_DETECTED", {
        prNumber,
        consecutiveFailures: outcome.streak
      });
    }

    if (validationResult.passed) {
      await this.publishEvent("VALIDATION_PASSED", { validationResult });
    } else {
      await this.publishEvent("VALIDATION_FAILED", { validationResult });

      const repoOwner = process.env.GITHUB_REPO_OWNER ?? "";
      const repoName = process.env.GITHUB_REPO_NAME ?? "";
      if (repoOwner && repoName) {
        const body = this.reportService.buildValidationFailReport(validationResult);
        await this.reportService.postPrComment(repoOwner, repoName, prNumber, body);
      }
    }
  }

  private async handlePush(payload: GitHubPushPayload): Promise<void> {
    const commitSha = payload.after;
    const beforeSha = payload.before ?? "";
    this.logger.log(`코드 커밋 감지: ${commitSha}`);
    const codeDeltaSummary = this.codeDeltaRunner.runForPush(beforeSha, commitSha);
    await this.publishEvent("CODE_DELTA_ANALYZED", { codeDeltaSummary });
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
