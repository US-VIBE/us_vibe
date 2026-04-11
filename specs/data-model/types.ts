export interface User {
  id: string;
  email: string;
  createdAt: string;
}

// ── D. 인테그레이션 & 샌드박스 — 공유 타입 ─────────────────────────
// 변경 시 docs/integration-sandbox/collaboration-interface.md 2절,
// Postgres 미러 매핑은 docs/integration-sandbox/event-vocabulary-map.md 참조

export type IntegrationEventType =
  | "PR_OPENED"
  | "PR_UPDATED"
  | "PR_MERGED"
  | "VALIDATION_PASSED"
  | "VALIDATION_FAILED"
  | "VALIDATION_LOOP_DETECTED"
  | "CODE_DELTA_ANALYZED"
  | "CONTRACT_CHANGED"
  | "VFS_SNAPSHOT_CREATED"
  | "VFS_APPROVED";

export interface LintError {
  file: string;
  line: number;
  rule: string;
  message: string;
}

export interface ContractDiff {
  path: string;
  method: string;
  changeType: "added" | "removed" | "modified";
  affectedFields: string[];
  impactedConsumers: string[];
}

export interface ValidationResult {
  passed: boolean;
  checks: {
    lint: { passed: boolean; errors: LintError[] };
    typecheck: { passed: boolean; errors: string[] };
    contract: { passed: boolean; diffs: ContractDiff[] };
  };
  prNumber: number;
  commitSha: string;
}

export interface CodeDeltaSummary {
  commitSha: string;
  analyzedAt: string;
  newEndpoints: string[];
  modifiedEndpoints: string[];
  removedEndpoints: string[];
  dtoChanges: string[];
  riskItems: string[];
  contractChanged: boolean;
  changedFiles: string[];
}

export type IntegrationEventPayload =
  | { prNumber: number; branch: string; author: string }
  | { validationResult: ValidationResult }
  | { prNumber: number; consecutiveFailures: number }
  | { codeDeltaSummary: CodeDeltaSummary }
  | { contractDiffs: ContractDiff[]; openApiVersion: string }
  | { snapshotId: string; vfsBranch: string; diffUrl: string }
  | { snapshotId: string; targetBranch: string };

export interface IntegrationEvent {
  type: IntegrationEventType;
  sessionId: string;
  stateVersion: number;
  triggeredBy: "github" | "user" | "agent";
  payload: IntegrationEventPayload;
  timestamp: string;
}
