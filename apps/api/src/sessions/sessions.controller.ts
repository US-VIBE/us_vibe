import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post
} from "@nestjs/common";
import { getMonorepoRoot } from "../monorepo-root";
import { SessionsService } from "./sessions.service";

@Controller("sessions")
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post(":id/run-scenario/finish")
  @HttpCode(HttpStatus.OK)
  async runScenarioFinish(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.sessions.runAiScenarioFinish(id);
  }

  @Post(":id/orchestrate")
  @HttpCode(HttpStatus.OK)
  async orchestrate(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: { userMessage?: string }
  ) {
    return this.sessions.orchestrate(id, body);
  }

  @Post(":id/run-scenario")
  @HttpCode(HttpStatus.OK)
  async runScenario(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body?: { skipImplementationWait?: boolean }
  ) {
    return this.sessions.runAiScenario(id, body);
  }

  @Post(":id/implementation-ready")
  @HttpCode(HttpStatus.OK)
  async implementationReady(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body?: { notes?: string | null }
  ) {
    return this.sessions.acknowledgeImplementation(id, body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body()
    body: {
      learnerRole?: string;
      learningGoal?: string;
      topic?: string;
      sprintDuration?: string;
      skillLevel?: string;
      activeRoles?: string[];
      scenarioId?: string | null;
    }
  ) {
    return this.sessions.create(body);
  }

  @Get(":id/timeline")
  async timeline(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.sessions.timeline(id);
  }

  @Post(":id/verify")
  @HttpCode(HttpStatus.OK)
  async verify(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.sessions.verify(id, getMonorepoRoot());
  }

  @Get(":id")
  async getOne(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.sessions.getOne(id);
  }

  @Patch(":id")
  async patch(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body()
    body: {
      targetGate?: "A" | "B" | "C" | "D" | "DONE";
      implementationNotes?: string | null;
      retroSummary?: Record<string, unknown> | null;
    }
  ) {
    return this.sessions.patch(id, body);
  }
}
