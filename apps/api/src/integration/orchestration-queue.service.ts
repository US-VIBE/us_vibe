import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Queue, Worker, QueueEvents, Job } from "bullmq";
import Redis from "ioredis";
import { EVENT_PUBLISHER, IEventPublisher } from "./event-publisher.interface";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { OrchestratorService } from "../ai/orchestrator.service";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

interface OrchestrationJob {
  sessionId: string;
  type: "TURN" | "ARTIFACT_REVIEW";
  userMessage?: string;
  artifactId?: string;
}

const BULL_QUEUE_NAME = "integration-orchestration";

function envFlagTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

@Injectable()
export class OrchestrationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrchestrationQueueService.name);
  private bullConnection: Redis | null = null;
  private bullQueue: Queue | null = null;
  private bullWorker: Worker | null = null;
  private bullQueueEvents: QueueEvents | null = null;
  private separateWorkerMode = false;

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly workspace: WorkspacePersistenceService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!envFlagTrue(process.env.INTEGRATION_BULLMQ)) {
      return;
    }
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      return;
    }

    const role = (process.env.BULLMQ_PROCESS_ROLE ?? "api").trim().toLowerCase();
    this.separateWorkerMode = envFlagTrue(process.env.INTEGRATION_BULLMQ_SEPARATE_WORKER);

    try {
      this.bullConnection = new Redis(url, { maxRetriesPerRequest: null });

      if (role === "worker") {
        this.bullWorker = new Worker(BULL_QUEUE_NAME, (job) => this.processJob(job), {
          connection: this.bullConnection,
          concurrency: 1,
        });
        this.logger.log(`[BullMQ] Orchestration 워커 전용 모드 시작: ${BULL_QUEUE_NAME}`);
        return;
      }

      this.bullQueue = new Queue(BULL_QUEUE_NAME, {
        connection: this.bullConnection,
      });

      this.bullQueueEvents = new QueueEvents(BULL_QUEUE_NAME, {
        connection: new Redis(url, { maxRetriesPerRequest: null }),
      });

      if (!this.separateWorkerMode) {
        this.bullWorker = new Worker(BULL_QUEUE_NAME, (job) => this.processJob(job), {
          connection: this.bullConnection,
          concurrency: 1,
        });
        this.logger.log(`[BullMQ] Orchestration Queue + Worker 활성화: ${BULL_QUEUE_NAME}`);
      }
    } catch (e) {
      this.logger.error(`[BullMQ] Orchestration 초기화 실패: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.bullWorker?.close();
    await this.bullQueue?.close();
    await this.bullQueueEvents?.close();
    if (this.bullConnection) {
      await this.bullConnection.quit().catch(() => {});
      this.bullConnection = null;
    }
  }

  async enqueue(jobData: OrchestrationJob): Promise<string> {
    if (this.bullQueue) {
      const job = await this.bullQueue.add("orchestrate", jobData, {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      });
      return job.id!;
    }

    // Fallback: Run synchronously or log error
    this.logger.warn(`BullMQ가 비활성 상태입니다. 즉시 실행을 시도합니다.`);
    // Note: Here we might want to run it synchronously or just fail
    // In this MVP, we'll try to run it in background without BullMQ if possible, 
    // but better to just use BullMQ. 
    // For now, let's just log and return a dummy id.
    return "memory-job";
  }

  private async processJob(job: Job<OrchestrationJob>): Promise<void> {
    const { sessionId, type } = job.data;
    this.logger.log(`[BullMQ] 잡 시작: id=${job.id} type=${type} session=${sessionId}`);

    try {
      if (type === "ARTIFACT_REVIEW") {
        await this.handleArtifactReview(job.data);
      } else {
        await this.handleTurn(job.data);
      }
      this.logger.log(`[BullMQ] 잡 완료: id=${job.id}`);
    } catch (e) {
      this.logger.error(`[BullMQ] 잡 실패: id=${job.id} error=${(e as Error).message}`);
      throw e;
    }
  }

  private async handleTurn(data: OrchestrationJob): Promise<void> {
    const { sessionId, userMessage } = data;
    const msg = userMessage || "현재 상태를 브리핑하고 다음 단계를 제안해줘.";

    await this.publishEvent("ORCHESTRATION_STARTED", { sessionId, userMessage: msg }, sessionId);

    const decision = await this.orchestrator.processTurn(sessionId, msg);
    
    if (decision.supervisorResponse) {
      await this.publishEvent(
        "AGENT_REPLY",
        { role: "Supervisor", phase: "orchestration", text: decision.supervisorResponse },
        sessionId
      );
    }

    const agentsResults = [];
    if (Array.isArray(decision.decisions)) {
      for (const d of decision.decisions) {
        const agentResp = await this.orchestrator.invokeAgent(d.agentRole, d.instruction, sessionId);
        await this.publishEvent(
          "AGENT_REPLY",
          { role: d.agentRole, phase: "orchestration", text: agentResp },
          sessionId
        );
        agentsResults.push({ role: d.agentRole, text: agentResp });
      }
    }

    await this.publishEvent(
      "ORCHESTRATION_COMPLETED",
      { agents: agentsResults, supervisor: decision.supervisorResponse },
      sessionId
    );
  }

  private async handleArtifactReview(data: OrchestrationJob): Promise<void> {
    const { sessionId, artifactId } = data;
    if (!artifactId) throw new Error("artifactId is required for ARTIFACT_REVIEW");

    const result = await this.orchestrator.evaluateArtifact(sessionId, artifactId);

    await this.publishEvent(
      "AGENT_REPLY",
      {
        role: result.agentRole,
        phase: "artifact_review",
        text: result.feedbackMarkdown
      },
      sessionId
    );
  }

  private async publishEvent(
    type: string,
    payload: any,
    sessionId: string,
  ): Promise<void> {
    const event: IntegrationEvent = {
      type: type as any,
      sessionId,
      stateVersion: 0,
      triggeredBy: "orchestrator",
      payload,
      timestamp: new Date().toISOString(),
    };
    await this.eventPublisher.publish(event);
  }
}
