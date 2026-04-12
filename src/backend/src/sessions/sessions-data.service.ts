import type { SimulationGate } from "../entities/simulation-session.entity";
import { SimulationSession } from "../entities/simulation-session.entity";
import { contractFilesPresent } from "./contract-files";

const DEFAULT_ACTIVE_ROLES = [
  "PM",
  "FE",
  "QA",
  "Senior",
  "Supervisor",
  "Coach"
] as const;

export type CreateSimulationSessionInput = {
  learnerRole?: string;
  learningGoal: string;
  topic: string;
  scenarioId?: string | null;
  sprintDuration: string;
  skillLevel: string;
  activeRoles?: string[];
};

export class SessionsDataService {
  constructor(private readonly sessions: any) {}

  async create(input: CreateSimulationSessionInput): Promise<SimulationSession> {
    const row = this.sessions.create({
      learnerRole: (input.learnerRole ?? "Backend Developer").trim(),
      learningGoal: input.learningGoal.trim(),
      topic: input.topic.trim(),
      scenarioId: input.scenarioId?.trim() ? input.scenarioId.trim() : null,
      sprintDuration: input.sprintDuration.trim(),
      skillLevel: input.skillLevel.trim(),
      activeRoles: input.activeRoles?.length
        ? input.activeRoles
        : [...DEFAULT_ACTIVE_ROLES],
      currentGate: "A" as SimulationGate,
      gateHistory: [],
      implementationNotes: null,
      implementationAcknowledgedAt: null,
      retroSummary: null
    });
    return this.sessions.save(row) as Promise<SimulationSession>;
  }

  async findById(id: string): Promise<SimulationSession | null> {
    return this.sessions.findOne({ where: { id } });
  }

  async updateNotes(
    id: string,
    implementationNotes: string | null
  ): Promise<SimulationSession | null> {
    const row = await this.findById(id);
    if (!row) {
      return null;
    }
    row.implementationNotes = implementationNotes;
    return this.sessions.save(row) as Promise<SimulationSession>;
  }

  private pushHistory(
    row: SimulationSession,
    from: string,
    to: string,
    reason: string
  ): void {
    const entry = {
      at: new Date().toISOString(),
      from,
      to,
      reason
    };
    row.gateHistory = [...(row.gateHistory ?? []), entry];
    row.currentGate = to as SimulationGate;
  }

  /**
   * Manual gate moves (not B→C; that is only via verify).
   */
  async transitionGate(
    id: string,
    target: SimulationGate,
    options?: { retroSummary?: Record<string, unknown> | null }
  ): Promise<SimulationSession | null> {
    const row = await this.findById(id);
    if (!row) {
      return null;
    }
    const from = row.currentGate;
    if (from === target) {
      return row;
    }
    if (from === "B" && target === "C") {
      throw new Error("GATE_VERIFY_REQUIRED");
    }
    const allowed: Record<string, SimulationGate[]> = {
      A: ["B"],
      B: [],
      C: ["D"],
      D: ["DONE"],
      DONE: []
    };
    const next = allowed[from] ?? [];
    if (!next.includes(target)) {
      throw new Error("GATE_TRANSITION_INVALID");
    }
    if (target === "DONE" && options?.retroSummary !== undefined) {
      row.retroSummary = options.retroSummary;
    }
    if (from === "A" && target === "B") {
      row.implementationAcknowledgedAt = null;
    }
    this.pushHistory(row, from, target, "manual_patch");
    return this.sessions.save(row) as Promise<SimulationSession>;
  }

  async acknowledgeImplementation(
    id: string,
    implementationNotes?: string | null
  ): Promise<SimulationSession | null> {
    const row = await this.findById(id);
    if (!row) {
      return null;
    }
    if (row.currentGate !== "B") {
      throw new Error("ACK_WRONG_GATE");
    }
    row.implementationAcknowledgedAt = new Date();
    if (implementationNotes !== undefined) {
      row.implementationNotes = implementationNotes;
    }
    return this.sessions.save(row) as Promise<SimulationSession>;
  }

  /**
   * When at gate B: run checks and move to C.
   */
  async completeVerification(
    id: string,
    repoRoot: string,
    pingDb: () => Promise<void>,
    options?: { skipImplementationAck?: boolean }
  ): Promise<
    | { ok: true; session: SimulationSession }
    | { ok: false; code: string; message: string }
  > {
    const row = await this.findById(id);
    if (!row) {
      return { ok: false, code: "SESSION_NOT_FOUND", message: "session not found" };
    }
    if (row.currentGate !== "B") {
      return {
        ok: false,
        code: "VERIFY_WRONG_GATE",
        message: "verify is only allowed when currentGate is B"
      };
    }
    if (
      !options?.skipImplementationAck &&
      row.implementationAcknowledgedAt == null
    ) {
      return {
        ok: false,
        code: "IMPLEMENTATION_NOT_ACKNOWLEDGED",
        message:
          "call POST /sessions/:id/implementation-ready after finishing your implementation"
      };
    }
    try {
      await pingDb();
    } catch {
      return {
        ok: false,
        code: "VERIFY_DB_FAILED",
        message: "database connectivity check failed"
      };
    }
    const files = contractFilesPresent(repoRoot);
    if (!files.ok) {
      return {
        ok: false,
        code: "VERIFY_CONTRACT_FILES",
        message: `missing: ${files.missing.join(", ")}`
      };
    }
    this.pushHistory(row, "B", "C", "verify_passed");
    const session = (await this.sessions.save(row)) as SimulationSession;
    return { ok: true, session };
  }

  async setRetroSummary(
    id: string,
    retroSummary: Record<string, unknown> | null
  ): Promise<SimulationSession | null> {
    const row = await this.findById(id);
    if (!row) {
      return null;
    }
    row.retroSummary = retroSummary;
    return this.sessions.save(row) as Promise<SimulationSession>;
  }
}
