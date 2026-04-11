import { Inject, Injectable, Logger } from "@nestjs/common";
import { ValidationService } from "./validation.service";
import { ReportService } from "./report.service";
import { EVENT_PUBLISHER, IEventPublisher } from "./event-publisher.interface";
import type { IntegrationEvent, IntegrationEventType } from "../../../../specs/data-model/types";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

interface PrValidationJob {
  prNumber: number;
  commitSha: string;
}

function envFlagTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

@Injectable()
export class WebhookPrValidationService {
  private readonly logger = new Logger(WebhookPrValidationService.name);
  private readonly queue: PrValidationJob[] = [];
  private pumping = false;

  constructor(
    private readonly validationService: ValidationService,
    private readonly reportService: ReportService,
    private readonly workspace: WorkspacePersistenceService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {}

  private webhookRaceMaxMs(): number {
    return Math.min(
      120_000,
      Math.max(5_000, Number(process.env.WEBHOOK_VALIDATION_MAX_MS ?? 28_000)),
    );
  }

  /**
   * PR 이벤트 발행 이후 호출. 루프 가드·동기 레이스·비동기 큐·타임아웃 시 큐 이관.
   */
  async scheduleOrRunValidation(prNumber: number, commitSha: string): Promise<void> {
    const streak = this.workspace.getValidationFailureStreak(prNumber);
    if (streak >= 5) {
      this.logger.warn(
        `PR #${prNumber} 검증 루프 상한(5회 연속 실패) — 정적 검증 스킵`,
      );
      await this.publishEvent("VALIDATION_LOOP_DETECTED", {
        prNumber,
        consecutiveFailures: streak,
      });
      return;
    }

    if (envFlagTrue(process.env.WEBHOOK_VALIDATION_ASYNC)) {
      this.enqueue({ prNumber, commitSha });
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
      await this.finalizeValidation(prNumber, validationResult);
    } catch (e) {
      if ((e as Error).message === "WEBHOOK_VALIDATION_TIMEOUT") {
        this.logger.warn(
          `PR #${prNumber} 정적 검증 타임아웃 (${maxMs}ms) — 인메모리 큐로 이관`,
        );
        this.enqueue({ prNumber, commitSha });
        return;
      }
      throw e;
    }
  }

  private enqueue(job: PrValidationJob): void {
    this.queue.push(job);
    void this.pumpQueue();
  }

  private async pumpQueue(): Promise<void> {
    if (this.pumping) {
      return;
    }
    this.pumping = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        await this.runQueuedValidation(job.prNumber, job.commitSha);
      }
    } finally {
      this.pumping = false;
    }
  }

  private async runQueuedValidation(
    prNumber: number,
    commitSha: string,
  ): Promise<void> {
    const streak = this.workspace.getValidationFailureStreak(prNumber);
    if (streak >= 5) {
      this.logger.warn(
        `PR #${prNumber} (큐) 검증 루프 상한(5회 연속 실패) — 정적 검증 스킵`,
      );
      await this.publishEvent("VALIDATION_LOOP_DETECTED", {
        prNumber,
        consecutiveFailures: streak,
      });
      return;
    }

    const validationResult = await this.validationService.runAll(
      prNumber,
      commitSha,
    );
    await this.finalizeValidation(prNumber, validationResult);
  }

  private async finalizeValidation(
    prNumber: number,
    validationResult: Awaited<ReturnType<ValidationService["runAll"]>>,
  ): Promise<void> {
    this.workspace.savePrValidationResult(prNumber, validationResult);
    const outcome = this.workspace.recordValidationOutcome(
      prNumber,
      validationResult.passed,
    );
    if (outcome.loopJustDetected) {
      await this.publishEvent("VALIDATION_LOOP_DETECTED", {
        prNumber,
        consecutiveFailures: outcome.streak,
      });
    }

    if (validationResult.passed) {
      await this.publishEvent("VALIDATION_PASSED", { validationResult });
    } else {
      await this.publishEvent("VALIDATION_FAILED", { validationResult });

      const repoOwner = process.env.GITHUB_REPO_OWNER ?? "";
      const repoName = process.env.GITHUB_REPO_NAME ?? "";
      if (repoOwner && repoName) {
        const body =
          this.reportService.buildValidationFailReport(validationResult);
        await this.reportService.postPrComment(
          repoOwner,
          repoName,
          prNumber,
          body,
        );
      }
    }
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
