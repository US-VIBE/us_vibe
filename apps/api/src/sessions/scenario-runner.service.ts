import {
  CollaborationEventsDataService,
  SessionsDataService
} from "@us-vibe/backend";
import type { SimulationSession } from "@us-vibe/backend";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { GeminiService } from "../ai/gemini.service";
import { OrchestratorService } from "../ai/orchestrator.service";
import { OrchestrationQueueService } from "../integration/orchestration-queue.service";

const SYSTEM =
  "You are assisting a Backend Solo collaboration learning simulator. " +
  "Reply in Korean, concise (under 400 words each turn), practical tone. " +
  "No markdown code fences unless asked.";

@Injectable()
export class ScenarioRunnerService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly orchestrator: OrchestratorService,
    private readonly orchestrationQueue: OrchestrationQueueService,
    private readonly sessions: SessionsDataService,
    private readonly events: CollaborationEventsDataService,
    @InjectDataSource() private readonly dataSource: DataSource
  ) {}

  private assertGemini(): void {
    if (!this.gemini.isConfigured()) {
      throw new ServiceUnavailableException({
        code: "AI_NOT_CONFIGURED",
        message:
          "Set GEMINI_API_KEY in the API environment (server-only, never NEXT_PUBLIC_)."
      });
    }
  }

  private sessionContext(row: SimulationSession): string {
    return [
      `주제: ${row.topic}`,
      `학습 목표: ${row.learningGoal}`,
      `스프린트: ${row.sprintDuration}`,
      `숙련도: ${row.skillLevel}`,
      `역할(활성): ${row.activeRoles.join(", ")}`
    ].join("\n");
  }

  /**
   * Gate A → B + contract AI. Stops before verify; learner must acknowledge implementation then POST verify.
   */
  async runIntro(sessionId: string): Promise<{
    session: SimulationSession;
    steps: string[];
    pausedForImplementation: true;
  }> {
    this.assertGemini();
    const row = await this.sessions.findById(sessionId);
    if (!row) {
      throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
    }
    if (row.currentGate !== "A") {
      throw new BadRequestException({
        code: "SCENARIO_BAD_STATE",
        message: "run-scenario intro requires currentGate A."
      });
    }

    const steps: string[] = [];
    const sid = sessionId;
    const ctx = this.sessionContext(row);

    const kickoff = await this.gemini.generateText(
      SYSTEM,
      `${ctx}\n\nPM으로 킥오프 회의 발언을 작성하라. 목표·범위·일정(설계→구현→리뷰→QA→회고)을 짧게.`
    );
    await this.events.append(
      "AGENT_REPLY",
      { role: "PM", phase: "kickoff", text: kickoff },
      sid
    );
    await this.events.append(
      "kickoff_complete",
      { summary: kickoff.slice(0, 500) },
      sid
    );
    steps.push("kickoff");

    const session = await this.sessions.transitionGate(sid, "B");
    if (!session) {
      throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
    }
    steps.push("gate_A_to_B");

    const fe = await this.gemini.generateText(
      SYSTEM,
      `${ctx}\n\nFE 관점에서 API 계약에서 확인하고 싶은 질문 3가지를 bullet로.`
    );
    await this.events.append(
      "AGENT_REPLY",
      { role: "FE", phase: "contract", text: fe },
      sid
    );
    steps.push("fe_contract");

    const qa = await this.gemini.generateText(
      SYSTEM,
      `${ctx}\n\nQA 관점에서 실패/예외 테스트 케이스 4가지를 bullet로.`
    );
    await this.events.append(
      "AGENT_REPLY",
      { role: "QA", phase: "contract", text: qa },
      sid
    );
    steps.push("qa_contract");

    await this.events.append(
      "AGENT_REPLY",
      {
        role: "Supervisor",
        phase: "implementation_wait",
        text:
          "구현 단계입니다. 백엔드 학습자가 구현을 마친 뒤 POST /sessions/{id}/implementation-ready 를 호출한 다음 POST /sessions/{id}/verify 로 검증하세요."
      },
      sid
    );
    steps.push("paused_for_implementation");

    const latest = await this.sessions.findById(sid);
    if (!latest) {
      throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
    }
    return { session: latest, steps, pausedForImplementation: true };
  }

  /**
   * After verify (gate C): Senior + retro through DONE.
   */
  async runFinish(sessionId: string): Promise<{
    session: SimulationSession;
    steps: string[];
  }> {
    this.assertGemini();
    const row = await this.sessions.findById(sessionId);
    if (!row) {
      throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
    }
    if (row.currentGate !== "C") {
      throw new BadRequestException({
        code: "FINISH_WRONG_GATE",
        message: "run-scenario/finish requires currentGate C (after successful verify)."
      });
    }

    const steps: string[] = [];
    const sid = sessionId;
    const ctx = this.sessionContext(row);

    const senior = await this.gemini.generateText(
      SYSTEM,
      `${ctx}\n\nSenior으로 짧은 리뷰: 보안·에러응답 일관성·확장성 관점에서 질문 3개.`
    );
    await this.events.append(
      "AGENT_REPLY",
      { role: "Senior", phase: "review", text: senior },
      sid
    );
    await this.events.append("review_passed", { notes: senior.slice(0, 400) }, sid);
    steps.push("review");

    let session = await this.sessions.transitionGate(sid, "D");
    if (!session) {
      throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
    }
    steps.push("gate_C_to_D");

    const retroText = await this.gemini.generateText(
      SYSTEM,
      `${ctx}\n\n스프린트 회고: 역할 균형·재작업·리뷰 반영·커뮤니케이션을 한 줄씩 평가하고, 다음 스프린트 액션 3개를 bullet로.`
    );
    let retroSummary: Record<string, unknown> = { narrative: retroText };
    try {
      const maybeJson = retroText.match(/\{[\s\S]*\}/);
      if (maybeJson) {
        retroSummary = JSON.parse(maybeJson[0]) as Record<string, unknown>;
      }
    } catch {
      /* keep narrative */
    }

    session = await this.sessions.transitionGate(sid, "DONE", {
      retroSummary
    });
    if (!session) {
      throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
    }
    await this.events.append(
      "retro_complete",
      { summary: retroSummary },
      sid
    );
    steps.push("retro_done");

    return { session, steps };
  }

  /**
   * Legacy one-shot demo (skips implementation acknowledgement). For local demos only.
   */
  async runFullSkipImplementationWait(
    sessionId: string,
    repoRoot: string
  ): Promise<{ session: SimulationSession; steps: string[] }> {
    this.assertGemini();
    const intro = await this.runIntro(sessionId);
    const sid = sessionId;
    const pingDb = async (): Promise<void> => {
      await this.dataSource.query("SELECT 1");
    };
    const verified = await this.sessions.completeVerification(sid, repoRoot, pingDb, {
      skipImplementationAck: true
    });
    if (!verified.ok) {
      throw new BadRequestException({
        code: verified.code,
        message: verified.message
      });
    }
    const steps = [...intro.steps, "verify_to_C"];
    await this.events.append(
      "AGENT_REPLY",
      {
        role: "Supervisor",
        phase: "verify",
        text: "데모 모드: 구현 확인을 건너뛰고 검증 통과(Gate C)."
      },
      sid
    );
    const fin = await this.runFinish(sessionId);
    return { session: fin.session, steps: [...steps, ...fin.steps] };
  }

  /**
   * O-1: Trigger dynamic orchestration turn (Async via BullMQ).
   */
  async orchestrate(sessionId: string, userMessage: string): Promise<any> {
    const jobId = await this.orchestrationQueue.enqueue({ sessionId, userMessage });
    return { ok: true, jobId, message: "Orchestration task queued." };
  }

  /**
   * Sync version for legacy/internal use if needed.
   */
  async orchestrateSync(sessionId: string, userMessage: string): Promise<any> {
    const decision = await this.orchestrator.processTurn(sessionId, userMessage);
    
    if (decision.supervisorResponse) {
      await this.events.append(
        "AGENT_REPLY",
        { role: "Supervisor", phase: "orchestration", text: decision.supervisorResponse },
        sessionId
      );
    }

    const results = [];
    if (Array.isArray(decision.decisions)) {
      for (const d of decision.decisions) {
        const agentResp = await this.orchestrator.invokeAgent(d.agentRole, d.instruction, sessionId);
        await this.events.append(
          "AGENT_REPLY",
          { role: d.agentRole, phase: "orchestration", text: agentResp },
          sessionId
        );
        results.push({ role: d.agentRole, text: agentResp });
      }
    }

    return { supervisor: decision.supervisorResponse, agents: results };
  }
}
