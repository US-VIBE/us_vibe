import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
/** CJS `export =` — default import는 ts-node에서 `default is not a constructor` 로 깨짐 */
import Database = require("better-sqlite3");
import * as fs from "fs";
import * as path from "path";
import type { IntegrationEvent, ValidationResult } from "../../../../specs/data-model/types";

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
}

/** GitHub 웹훅 정적 검증 결과 — SQLite `pr_validation_cache` SSOT */
export interface PrValidationStatusRecord {
  prNumber: number;
  result: ValidationResult;
  checkedAt: string;
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
    `);
    this.logger.log(`SQLite workspace state: ${dbPath}`);
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
  } {
    const row = this.db
      .prepare(
        "SELECT pr_snapshot, contract_state, retro_reports FROM workspace_session WHERE session_id = ?"
      )
      .get(sessionId) as
      | { pr_snapshot: string | null; contract_state: string | null; retro_reports: string | null }
      | undefined;
    return {
      pr: row?.pr_snapshot ? (JSON.parse(row.pr_snapshot) as PrSnap) : idlePr(sessionId),
      contract: row?.contract_state ? (JSON.parse(row.contract_state) as ContractState) : defaultContract(),
      retro: row?.retro_reports ? (JSON.parse(row.retro_reports) as RetroReport[]) : []
    };
  }

  private setFull(
    sessionId: string,
    data: { pr: PrSnap; contract: ContractState; retro: RetroReport[] }
  ): void {
    this.db
      .prepare(
        `INSERT INTO workspace_session (session_id, pr_snapshot, contract_state, retro_reports, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           pr_snapshot = excluded.pr_snapshot,
           contract_state = excluded.contract_state,
           retro_reports = excluded.retro_reports,
           updated_at = excluded.updated_at`
      )
      .run(
        sessionId,
        JSON.stringify(data.pr),
        JSON.stringify(data.contract),
        JSON.stringify(data.retro),
        new Date().toISOString()
      );
  }

  getPrSnapshot(sessionId: string): PrSnap {
    return this.getFull(sessionId).pr;
  }

  savePrSnapshot(sessionId: string, pr: PrSnap): void {
    const f = this.getFull(sessionId);
    f.pr = pr;
    this.setFull(sessionId, f);
  }

  getContractState(sessionId: string): ContractState {
    return this.getFull(sessionId).contract;
  }

  saveContractState(sessionId: string, contract: ContractState): void {
    const f = this.getFull(sessionId);
    f.contract = contract;
    this.setFull(sessionId, f);
  }

  getRetroReports(sessionId: string): RetroReport[] {
    return this.getFull(sessionId).retro;
  }

  saveRetroReports(sessionId: string, reports: RetroReport[]): void {
    const f = this.getFull(sessionId);
    f.retro = reports;
    this.setFull(sessionId, f);
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

  getPrValidationResult(prNumber: number): PrValidationStatusRecord | null {
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
