import { ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import type {
  CodeDeltaSummary,
  IntegrationEvent,
  ValidationResult,
} from "../../../../specs/data-model/types";

/** PR 리뷰 스냅샷 — pr-review.controller와 동일 형태 */
export type PrCommentStatus = "pending" | "addressed" | "deferred" | "needs_clarification";

export interface PrComment {
  id: string;
  authorRole: string;
  authorLabel: string;
  body: string;
  status: PrCommentStatus;
}

export interface PrSnap {
  sessionId: string;
  stateVersion: number;
  prNumber: number | null;
  branch: string | null;
  revisionRound: number;
  phase: "idle" | "open" | "approved";
  comments: PrComment[];
}

export interface ContractState {
  lastValidation: ValidationResult | null;
  contractApproved: boolean;
}

export interface RetroKpi {
  roleBalanceScore: number;
  reworkRatePercent: number;
  reviewReflectionPercent: number;
  communicationScore: number;
}

export interface RetroReport {
  id: string;
  sessionId: string;
  createdAt: string;
  kpis: RetroKpi;
  nextActions: [string, string, string];
  /** F-6: 이벤트 로그 기반 KPI 산출 근거 한 줄 */
  kpiBasis?: string;
}

/** SQLite `session_profile` — Sprint1 역할·Prompt-to-Spec 게이트 */
export interface WorkspaceSessionProfile {
  humanRoleIds: string[];
  promptSpecApprovedVersion: number | null;
  promptSpecApprovedAt: string | null;
}

/** 설계 §33 SSOT 요약 — 워크스페이스 영속 */
export interface ProjectStateRecord {
  stateVersion: number;
  approvedRequirements: string[];
  currentApiSpecs: string[];
  rejectedDecisions: string[];
  openQuestions: string[];
  activeSprintGoal: string | null;
  /** push 웹훅 `CODE_DELTA_ANALYZED` 시 SQLite에 병합(O-4). 없으면 null */
  codeDeltaSummary: CodeDeltaSummary | null;
  lastCodeDeltaAt: string | null;
}

/** GitHub 웹훅 정적 검증 결과 — SQLite `pr_validation_cache` SSOT */
export interface PrValidationCacheRow {
  prNumber: number;
  result: ValidationResult;
  checkedAt: string;
}

/** GET /api/validation/status 응답 본문 — 캐시 없어도 streak 노출 */
export interface PrValidationStatusEnvelope {
  prNumber: number;
  consecutiveFailures: number;
  /** SQLite 캐시가 있을 때만 */
  validation: PrValidationCacheRow | null;
}

function idlePr(sessionId: string): PrSnap {
  return {
    sessionId,
    stateVersion: 1,
    prNumber: null,
    branch: null,
    revisionRound: 0,
    phase: "idle",
    comments: []
  };
}

function defaultContract(): ContractState {
  return { lastValidation: null, contractApproved: false };
}

function defaultSessionProfile(): WorkspaceSessionProfile {
  return {
    humanRoleIds: ["be"],
    promptSpecApprovedVersion: null,
    promptSpecApprovedAt: null
  };
}

function cloneCodeDeltaSummary(s: CodeDeltaSummary): CodeDeltaSummary {
  return {
    ...s,
    newEndpoints: [...s.newEndpoints],
    modifiedEndpoints: [...s.modifiedEndpoints],
    removedEndpoints: [...s.removedEndpoints],
    dtoChanges: [...s.dtoChanges],
    riskItems: [...s.riskItems],
    changedFiles: [...s.changedFiles],
  };
}

function normalizeProjectState(raw: unknown): ProjectStateRecord {
  const d = defaultProjectState();
  if (!raw || typeof raw !== "object") {
    return d;
  }
  const o = raw as Record<string, unknown>;
  return {
    stateVersion: typeof o.stateVersion === "number" ? o.stateVersion : d.stateVersion,
    approvedRequirements: Array.isArray(o.approvedRequirements)
      ? [...(o.approvedRequirements as string[])]
      : [...d.approvedRequirements],
    currentApiSpecs: Array.isArray(o.currentApiSpecs)
      ? [...(o.currentApiSpecs as string[])]
      : [...d.currentApiSpecs],
    rejectedDecisions: Array.isArray(o.rejectedDecisions)
      ? [...(o.rejectedDecisions as string[])]
      : [...d.rejectedDecisions],
    openQuestions: Array.isArray(o.openQuestions)
      ? [...(o.openQuestions as string[])]
      : [...d.openQuestions],
    activeSprintGoal:
      o.activeSprintGoal === undefined
        ? d.activeSprintGoal
        : (o.activeSprintGoal as string | null),
    codeDeltaSummary:
      o.codeDeltaSummary != null && typeof o.codeDeltaSummary === "object"
        ? cloneCodeDeltaSummary(o.codeDeltaSummary as CodeDeltaSummary)
        : null,
    lastCodeDeltaAt:
      typeof o.lastCodeDeltaAt === "string" ? o.lastCodeDeltaAt : null,
  };
}

function defaultProjectState(): ProjectStateRecord {
  return {
    stateVersion: 1,
    approvedRequirements: [],
    currentApiSpecs: ["specs/openapi/v1.yaml"],
    rejectedDecisions: [],
    openQuestions: [],
    activeSprintGoal: null,
    codeDeltaSummary: null,
    lastCodeDeltaAt: null,
  };
}

@Injectable()
export class WorkspacePersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkspacePersistenceService.name);
  private db!: InstanceType<typeof Database>;

  onModuleInit(): void {
    const dbPath =
      process.env.DATABASE_PATH?.trim() || path.join(process.cwd(), "data", "usvibe.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_session (
        session_id TEXT PRIMARY KEY,
        pr_snapshot TEXT,
        contract_state TEXT,
        retro_reports TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS integration_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        session_id TEXT NOT NULL,
        state_version INTEGER NOT NULL,
        triggered_by TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_integration_events_session_id
        ON integration_events (session_id, id DESC);
      CREATE TABLE IF NOT EXISTS pr_validation_cache (
        pr_number INTEGER PRIMARY KEY,
        result_json TEXT NOT NULL,
        checked_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pr_validation_failure_streak (
        pr_number INTEGER PRIMARY KEY,
        streak INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);
    this.ensureColumn("workspace_session", "session_profile", "TEXT");
    this.ensureColumn("workspace_session", "project_state", "TEXT");
    this.ensureColumn("workspace_session", "owner_user_id", "TEXT");
    this.logger.log(`SQLite workspace state: ${dbPath}`);
  }

  /**
   * S-1: JWT `sub`와 워크스페이스 행을 묶는다. 최초 쓰기 시 `owner_user_id`가 비어 있으면 해당 사용자로 채운다.
   */
  getWorkspaceOwnerUserId(sessionId: string): string | null {
    const row = this.db
      .prepare("SELECT owner_user_id FROM workspace_session WHERE session_id = ?")
      .get(sessionId) as { owner_user_id: string | null } | undefined;
    if (!row) {
      return null;
    }
    return row.owner_user_id ?? null;
  }

  assertWorkspaceSessionAccess(sessionId: string, userId: string): void {
    const owner = this.getWorkspaceOwnerUserId(sessionId);
    if (owner != null && owner !== userId) {
      throw new ForbiddenException("이 워크스페이스에 접근할 수 없습니다.");
    }
  }

  private ensureColumn(table: string, column: string, sqlType: string): void {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (rows.some((r) => r.name === column)) {
      return;
    }
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`);
  }

  onModuleDestroy(): void {
    try {
      this.db?.close();
    } catch {
      /* noop */
    }
  }

  private getFull(sessionId: string): {
    pr: PrSnap;
    contract: ContractState;
    retro: RetroReport[];
    sessionProfile: WorkspaceSessionProfile;
    projectState: ProjectStateRecord;
  } {
    const row = this.db
      .prepare(
        "SELECT pr_snapshot, contract_state, retro_reports, session_profile, project_state FROM workspace_session WHERE session_id = ?"
      )
      .get(sessionId) as
      | {
          pr_snapshot: string | null;
          contract_state: string | null;
          retro_reports: string | null;
          session_profile: string | null;
          project_state: string | null;
        }
      | undefined;
    return {
      pr: row?.pr_snapshot ? (JSON.parse(row.pr_snapshot) as PrSnap) : idlePr(sessionId),
      contract: row?.contract_state ? (JSON.parse(row.contract_state) as ContractState) : defaultContract(),
      retro: row?.retro_reports ? (JSON.parse(row.retro_reports) as RetroReport[]) : [],
      sessionProfile: row?.session_profile
        ? (JSON.parse(row.session_profile) as WorkspaceSessionProfile)
        : defaultSessionProfile(),
      projectState: row?.project_state
        ? normalizeProjectState(JSON.parse(row.project_state))
        : defaultProjectState()
    };
  }

  private setFull(
    sessionId: string,
    data: {
      pr: PrSnap;
      contract: ContractState;
      retro: RetroReport[];
      sessionProfile: WorkspaceSessionProfile;
      projectState: ProjectStateRecord;
    },
    claimUserId?: string
  ): void {
    const ownerVal = claimUserId === undefined ? null : claimUserId;
    this.db
      .prepare(
        `INSERT INTO workspace_session (session_id, pr_snapshot, contract_state, retro_reports, session_profile, project_state, owner_user_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           pr_snapshot = excluded.pr_snapshot,
           contract_state = excluded.contract_state,
           retro_reports = excluded.retro_reports,
           session_profile = excluded.session_profile,
           project_state = excluded.project_state,
           owner_user_id = COALESCE(workspace_session.owner_user_id, excluded.owner_user_id),
           updated_at = excluded.updated_at`
      )
      .run(
        sessionId,
        JSON.stringify(data.pr),
        JSON.stringify(data.contract),
        JSON.stringify(data.retro),
        JSON.stringify(data.sessionProfile),
        JSON.stringify(data.projectState),
        ownerVal,
        new Date().toISOString()
      );
  }

  getPrSnapshot(sessionId: string): PrSnap {
    return this.getFull(sessionId).pr;
  }

  savePrSnapshot(sessionId: string, pr: PrSnap, actingUserId?: string): void {
    if (actingUserId) {
      this.assertWorkspaceSessionAccess(sessionId, actingUserId);
    }
    const f = this.getFull(sessionId);
    f.pr = pr;
    this.setFull(sessionId, f, actingUserId);
  }

  getSessionProfile(sessionId: string): WorkspaceSessionProfile {
    return { ...this.getFull(sessionId).sessionProfile };
  }

  saveSessionProfile(sessionId: string, profile: WorkspaceSessionProfile, actingUserId?: string): void {
    if (actingUserId) {
      this.assertWorkspaceSessionAccess(sessionId, actingUserId);
    }
    const f = this.getFull(sessionId);
    f.sessionProfile = { ...profile };
    this.setFull(sessionId, f, actingUserId);
  }

  getProjectState(sessionId: string): ProjectStateRecord {
    const p = this.getFull(sessionId).projectState;
    return {
      ...p,
      approvedRequirements: [...p.approvedRequirements],
      currentApiSpecs: [...p.currentApiSpecs],
      rejectedDecisions: [...p.rejectedDecisions],
      openQuestions: [...p.openQuestions],
      codeDeltaSummary: p.codeDeltaSummary
        ? cloneCodeDeltaSummary(p.codeDeltaSummary)
        : null,
      lastCodeDeltaAt: p.lastCodeDeltaAt,
    };
  }

  /** `workspace_session` 행 존재 여부 (기본 가상 상태와 구분) */
  workspaceSessionRowExists(sessionId: string): boolean {
    const row = this.db
      .prepare("SELECT 1 AS x FROM workspace_session WHERE session_id = ? LIMIT 1")
      .get(sessionId) as { x: number } | undefined;
    return row != null;
  }

  /**
   * push 웹훅 코드 델타 분석 결과를 SQLite ProjectState에 반영(O-4).
   * Postgres SSOT 타임라인은 동일 sessionId로 발행되는 Integration 이벤트가
   * `EventPublisherSqlite` → `IntegrationTimelineBridgeService` 경로로 `collaboration_events`에 미러될 때 맞춘다.
   * 해당 sessionId 행이 없으면 noop (학습 워크스페이스가 아직 만들어지지 않은 경우).
   */
  patchProjectStateCodeDelta(
    sessionId: string,
    summary: CodeDeltaSummary,
  ): void {
    if (!this.workspaceSessionRowExists(sessionId)) {
      this.logger.debug(
        `codeDelta ProjectState 스킵: workspace_session 없음 sessionId=${sessionId}`,
      );
      return;
    }
    const cur = this.getProjectState(sessionId);
    const next: ProjectStateRecord = {
      ...cur,
      codeDeltaSummary: cloneCodeDeltaSummary(summary),
      lastCodeDeltaAt: summary.analyzedAt,
      stateVersion: cur.stateVersion + 1,
    };
    this.saveProjectState(sessionId, next);
    this.logger.log(
      `ProjectState codeDelta 갱신: sessionId=${sessionId} sha=${summary.commitSha}`,
    );
  }

  saveProjectState(
    sessionId: string,
    state: ProjectStateRecord,
    expectedVersion?: number,
    actingUserId?: string
  ): { ok: true } | { ok: false; code: string } {
    if (actingUserId) {
      this.assertWorkspaceSessionAccess(sessionId, actingUserId);
    }
    const f = this.getFull(sessionId);
    if (expectedVersion != null && f.projectState.stateVersion !== expectedVersion) {
      return { ok: false, code: "VERSION_CONFLICT" };
    }
    f.projectState = { ...state, stateVersion: state.stateVersion };
    this.setFull(sessionId, f, actingUserId);
    return { ok: true };
  }

  getContractState(sessionId: string): ContractState {
    return this.getFull(sessionId).contract;
  }

  saveContractState(sessionId: string, contract: ContractState, actingUserId?: string): void {
    if (actingUserId) {
      this.assertWorkspaceSessionAccess(sessionId, actingUserId);
    }
    const f = this.getFull(sessionId);
    f.contract = contract;
    this.setFull(sessionId, f, actingUserId);
  }

  isPromptSpecApproved(sessionId: string): boolean {
    const v = this.getFull(sessionId).sessionProfile.promptSpecApprovedVersion;
    return v != null && v > 0;
  }

  getRetroReports(sessionId: string): RetroReport[] {
    return this.getFull(sessionId).retro;
  }

  saveRetroReports(sessionId: string, reports: RetroReport[], actingUserId?: string): void {
    if (actingUserId) {
      this.assertWorkspaceSessionAccess(sessionId, actingUserId);
    }
    const f = this.getFull(sessionId);
    f.retro = reports;
    this.setFull(sessionId, f, actingUserId);
  }

  /** PR 스냅샷 stateVersion — 워크스페이스 SSOT와 이벤트 상관에 사용 */
  getWorkspaceStateVersion(sessionId: string): number {
    return this.getPrSnapshot(sessionId).stateVersion;
  }

  /**
   * 통합 이벤트 스트림에 기록. `stateVersion`이 0이면 해당 sessionId에 대해 MAX+1 부여.
   */
  appendIntegrationEvent(event: IntegrationEvent): IntegrationEvent {
    const v =
      event.stateVersion > 0
        ? event.stateVersion
        : (
            this.db
              .prepare(
                `SELECT COALESCE(MAX(state_version), 0) + 1 AS v FROM integration_events WHERE session_id = ?`
              )
              .get(event.sessionId) as { v: number }
          ).v;
    const resolved: IntegrationEvent = { ...event, stateVersion: v };
    this.db
      .prepare(
        `INSERT INTO integration_events (type, session_id, state_version, triggered_by, payload_json, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        resolved.type,
        resolved.sessionId,
        resolved.stateVersion,
        resolved.triggeredBy,
        JSON.stringify(resolved.payload),
        resolved.timestamp
      );
    this.logger.debug(
      `[integration] ${resolved.type} session=${resolved.sessionId} v=${resolved.stateVersion} by=${resolved.triggeredBy}`
    );
    return resolved;
  }

  getValidationFailureStreak(prNumber: number): number {
    const row = this.db
      .prepare("SELECT streak FROM pr_validation_failure_streak WHERE pr_number = ?")
      .get(prNumber) as { streak: number } | undefined;
    return row?.streak ?? 0;
  }

  resetPrValidationStreak(prNumber: number): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO pr_validation_failure_streak (pr_number, streak, updated_at)
         VALUES (?, 0, ?)
         ON CONFLICT(pr_number) DO UPDATE SET streak = 0, updated_at = excluded.updated_at`
      )
      .run(prNumber, now);
  }

  /**
   * 검증 실패 시 streak 증가. 성공 시 0으로 리셋.
   * @returns loopJustDetected — 이번 실패로 streak가 정확히 5가 된 경우
   */
  recordValidationOutcome(
    prNumber: number,
    passed: boolean
  ): { streak: number; loopJustDetected: boolean } {
    const now = new Date().toISOString();
    if (passed) {
      this.resetPrValidationStreak(prNumber);
      return { streak: 0, loopJustDetected: false };
    }
    const prev = this.getValidationFailureStreak(prNumber);
    const next = prev + 1;
    this.db
      .prepare(
        `INSERT INTO pr_validation_failure_streak (pr_number, streak, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(pr_number) DO UPDATE SET streak = excluded.streak, updated_at = excluded.updated_at`
      )
      .run(prNumber, next, now);
    return { streak: next, loopJustDetected: next === 5 };
  }

  savePrValidationResult(prNumber: number, result: ValidationResult): void {
    const checkedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO pr_validation_cache (pr_number, result_json, checked_at)
         VALUES (?, ?, ?)
         ON CONFLICT(pr_number) DO UPDATE SET
           result_json = excluded.result_json,
           checked_at = excluded.checked_at`
      )
      .run(prNumber, JSON.stringify(result), checkedAt);
  }

  getPrValidationCacheRow(prNumber: number): PrValidationCacheRow | null {
    const row = this.db
      .prepare(
        "SELECT result_json, checked_at FROM pr_validation_cache WHERE pr_number = ?"
      )
      .get(prNumber) as { result_json: string; checked_at: string } | undefined;
    if (!row) {
      return null;
    }
    return {
      prNumber,
      result: JSON.parse(row.result_json) as ValidationResult,
      checkedAt: row.checked_at
    };
  }

  getPrValidationStatusEnvelope(prNumber: number): PrValidationStatusEnvelope {
    return {
      prNumber,
      consecutiveFailures: this.getValidationFailureStreak(prNumber),
      validation: this.getPrValidationCacheRow(prNumber)
    };
  }

  listIntegrationEvents(sessionId: string | undefined, limit: number): IntegrationEvent[] {
    const cap = Math.min(Math.max(1, limit), 200);
    const rows = sessionId
      ? this.db
          .prepare(
            `SELECT type, session_id, state_version, triggered_by, payload_json, timestamp
             FROM integration_events WHERE session_id = ? ORDER BY id DESC LIMIT ?`
          )
          .all(sessionId, cap)
      : this.db
          .prepare(
            `SELECT type, session_id, state_version, triggered_by, payload_json, timestamp
             FROM integration_events ORDER BY id DESC LIMIT ?`
          )
          .all(cap);
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      type: r.type,
      sessionId: r.session_id,
      stateVersion: r.state_version,
      triggeredBy: r.triggered_by,
      payload: JSON.parse(String(r.payload_json)),
      timestamp: r.timestamp
    })) as IntegrationEvent[];
  }
}
