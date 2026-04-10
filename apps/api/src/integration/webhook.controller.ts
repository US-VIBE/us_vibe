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

interface GitHubPrPayload {
  action: string;
  number: number;
  pull_request: {
    head: { sha: string; ref: string };
    user: { login: string };
  };
}

interface GitHubPushPayload {
  ref: string;
  after: string;
}

@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly validationService: ValidationService,
    private readonly reportService: ReportService,
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
    } else if (action === "closed" && (payload as unknown as Record<string, unknown>)["merged"] === true) {
      eventType = "PR_MERGED";
      await this.publishEvent(eventType, { prNumber, branch, author });
      return;
    } else {
      this.logger.debug(`PR 액션 무시: ${action}`);
      return;
    }

    // PR_OPENED / PR_UPDATED: 정적 검증 실행
    this.logger.log(`정적 검증 시작: PR #${prNumber} (${eventType})`);
    await this.publishEvent(eventType, { prNumber, branch, author });

    const validationResult = await this.validationService.runAll(prNumber, commitSha);

    if (validationResult.passed) {
      await this.publishEvent("VALIDATION_PASSED", { validationResult });
    } else {
      await this.publishEvent("VALIDATION_FAILED", { validationResult });

      // GitHub PR 코멘트 자동 작성
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
    this.logger.log(`코드 커밋 감지: ${commitSha}`);
    // CODE_COMMITTED 이벤트 발행 → code-delta-analyzer.js는 CI에서 실행되므로
    // 여기서는 이벤트만 발행하고 분석 결과는 CI 완료 후 파일에서 읽어온다.
    await this.publishEvent("CODE_DELTA_ANALYZED", {
      codeDeltaSummary: {
        commitSha,
        analyzedAt: new Date().toISOString(),
        newEndpoints: [],
        modifiedEndpoints: [],
        removedEndpoints: [],
        dtoChanges: [],
        riskItems: [],
        contractChanged: false,
        changedFiles: [],
      },
    });
  }

  private async publishEvent(
    type: IntegrationEventType,
    payload: IntegrationEvent["payload"],
  ): Promise<void> {
    const event: IntegrationEvent = {
      type,
      sessionId: "pending", // TODO: A의 GET /api/session/:sessionId/state-version 연동 후 실제 값으로 교체
      stateVersion: 0,       // TODO: A의 SSOT stateVersion 조회 후 실제 값으로 교체
      triggeredBy: "github",
      payload,
      timestamp: new Date().toISOString(),
    };
    await this.eventPublisher.publish(event);
  }
}
