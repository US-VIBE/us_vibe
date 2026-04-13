import { CollaborationEventsDataService } from "../../../../src/backend/src/collaboration/collaboration-events-data.service";
import type { SimulationGate } from "../../../../src/backend/src/entities/simulation-session.entity";
import { SessionsDataService } from "../../../../src/backend/src/sessions/sessions-data.service";
import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { getMonorepoRoot } from "../monorepo-root";
import {
  buildBriefingPayload,
  resolveScenario
} from "../scenarios/scenario-registry";
import { ScenarioRunnerService } from "./scenario-runner.service";

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessions: SessionsDataService,
    private readonly events: CollaborationEventsDataService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly scenarioRunner: ScenarioRunnerService
  ) {}

  async create(body: {
    learnerRole?: string;
    learningGoal?: string;
    topic?: string;
    sprintDuration?: string;
    skillLevel?: string;
    activeRoles?: string[];
    scenarioId?: string | null;
  }) {
    const topic = String(body.topic ?? "").trim();
    if (!topic) {
      throw new BadRequestException({
        code: "VALIDATION_SESSION_CONTEXT",
        message: "topic is required"
      });
    }

    const scenarioIdRaw =
      body.scenarioId !== undefined && body.scenarioId !== null
        ? String(body.scenarioId).trim()
        : "";
    const resolved = resolveScenario(topic, scenarioIdRaw || null);

    const learningGoalIn = String(body.learningGoal ?? "").trim();
    const sprintIn = String(body.sprintDuration ?? "").trim();
    const skillIn = String(body.skillLevel ?? "").trim();
    const useOverrides = learningGoalIn && sprintIn && skillIn;

    const learningGoal = useOverrides
      ? learningGoalIn
      : resolved.pack.defaults.learningGoal;
    const sprintDuration = useOverrides
      ? sprintIn
      : resolved.pack.defaults.sprintDuration;
    const skillLevel = useOverrides ? skillIn : resolved.pack.defaults.skillLevel;
    const activeRoles =
      body.activeRoles?.length && body.activeRoles.length > 0
        ? body.activeRoles
        : resolved.pack.defaults.activeRoles;

    const row = await this.sessions.create({
      learnerRole: body.learnerRole,
      learningGoal,
      topic,
      scenarioId: resolved.pack.id,
      sprintDuration,
      skillLevel,
      activeRoles
    });

    const briefing = buildBriefingPayload(
      resolved.pack,
      topic,
      row.id,
      resolved.resolvedBy
    );
    await this.events.append("scenario_briefing_published", briefing, row.id);

    return { ...row, briefing };
  }

  async getOne(id: string) {
    const row = await this.sessions.findById(id);
    if (!row) {
      throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
    }
    return row;
  }

  async patch(
    id: string,
    body: {
      targetGate?: SimulationGate;
      implementationNotes?: string | null;
      retroSummary?: Record<string, unknown> | null;
    }
  ) {
    await this.getOne(id);
    if (body.targetGate !== undefined) {
      try {
        let row = await this.sessions.transitionGate(id, body.targetGate, {
          retroSummary: body.retroSummary
        });
        if (!row) {
          throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
        }
        if (body.implementationNotes !== undefined) {
          const withNotes = await this.sessions.updateNotes(id, body.implementationNotes);
          if (withNotes) {
            row = withNotes;
          }
        }
        return row;
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof NotFoundException) {
          throw e;
        }
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "GATE_VERIFY_REQUIRED") {
          throw new BadRequestException({
            code: "GATE_VERIFY_REQUIRED",
            message: "use POST /sessions/:id/verify to move from B to C"
          });
        }
        if (msg === "GATE_TRANSITION_INVALID") {
          throw new BadRequestException({
            code: "GATE_TRANSITION_INVALID",
            message: "gate transition is not allowed"
          });
        }
        throw e;
      }
    }
    if (body.implementationNotes !== undefined) {
      const updated = await this.sessions.updateNotes(id, body.implementationNotes);
      if (!updated) {
        throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
      }
      return updated;
    }
    if (body.retroSummary !== undefined) {
      const updated = await this.sessions.setRetroSummary(id, body.retroSummary);
      if (!updated) {
        throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
      }
      return updated;
    }
    return this.getOne(id);
  }

  async verify(id: string, repoRoot: string) {
    const pingDb = async (): Promise<void> => {
      await this.dataSource.query("SELECT 1");
    };
    const result = await this.sessions.completeVerification(id, repoRoot, pingDb);
    if (!result.ok) {
      if (result.code === "SESSION_NOT_FOUND") {
        throw new NotFoundException({ code: result.code, message: result.message });
      }
      throw new BadRequestException({ code: result.code, message: result.message });
    }
    return result.session;
  }

  async timeline(id: string) {
    await this.getOne(id);
    return this.events.listBySessionId(id);
  }

  async acknowledgeImplementation(
    id: string,
    body?: { notes?: string | null }
  ) {
    try {
      const updated = await this.sessions.acknowledgeImplementation(
        id,
        body?.notes
      );
      if (!updated) {
        throw new NotFoundException({ code: "SESSION_NOT_FOUND", message: "session not found" });
      }
      await this.events.append(
        "implementation_acknowledged",
        {
          notes: body?.notes ?? null,
          at: new Date().toISOString()
        },
        id
      );
      return updated;
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "ACK_WRONG_GATE") {
        throw new BadRequestException({
          code: "ACK_WRONG_GATE",
          message: "implementation-ready is only allowed when currentGate is B"
        });
      }
      throw e;
    }
  }

  async runAiScenario(
    id: string,
    body?: { skipImplementationWait?: boolean }
  ) {
    try {
      if (body?.skipImplementationWait) {
        return await this.scenarioRunner.runFullSkipImplementationWait(
          id,
          getMonorepoRoot()
        );
      }
      return await this.scenarioRunner.runIntro(id);
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      const message = e instanceof Error ? e.message : String(e);
      throw new HttpException(
        {
          code: "AI_GENERATION_FAILED",
          message
        },
        502
      );
    }
  }

  async runAiScenarioFinish(id: string) {
    try {
      return await this.scenarioRunner.runFinish(id);
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      const message = e instanceof Error ? e.message : String(e);
      throw new HttpException(
        {
          code: "AI_GENERATION_FAILED",
          message
        },
        502
      );
    }
  }
}
