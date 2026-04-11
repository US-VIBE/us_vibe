#!/usr/bin/env node
/**
 * code-delta-analyzer.js
 *
 * 코드 변경 분석 스크립트 (D. 인테그레이션 & 샌드박스 소유)
 *
 * 기능:
 *   - git diff를 분석해 변경된 엔드포인트, DTO, 에러 정책 추출
 *   - specs/openapi/ 파일 변경 감지
 *   - CodeDeltaSummary 생성 및 출력
 *   - 결과를 .ai/code-delta-summary.json에 저장 (A 오케스트레이터가 SSOT 갱신에 사용)
 *
 * 사용:
 *   node scripts/code-delta-analyzer.js
 *   환경변수: GITHUB_SHA (현재 커밋 SHA)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, ".ai/code-delta-summary.json");

function run(cmd, fallback = "") {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return fallback;
  }
}

function info(msg) {
  console.log(`[INFO] ${msg}`);
}

// ── git diff 대상 결정 ────────────────────────────────────────────
// 웹훅 push: CODE_DELTA_BASE_SHA(before)·CODE_DELTA_HEAD_SHA(after) 우선
const currentSha =
  process.env.CODE_DELTA_HEAD_SHA?.trim() ||
  process.env.GITHUB_SHA ||
  run("git rev-parse HEAD");
let previousSha = process.env.CODE_DELTA_BASE_SHA?.trim() || "";
const zeroBase = !previousSha || /^0+$/.test(previousSha);

if (zeroBase) {
  previousSha = run("git rev-parse HEAD~1", "");
}

if (!previousSha) {
  info("이전 커밋이 없습니다. 초기 커밋으로 판단하고 전체 파일을 분석합니다.");
}

const diffTarget = previousSha ? `${previousSha}..${currentSha}` : currentSha;
info(`분석 대상: ${diffTarget}`);

// ── 변경 파일 목록 ────────────────────────────────────────────────
const changedFilesRaw = previousSha
  ? run(`git diff --name-only ${diffTarget}`)
  : run(`git show --name-only --format="" ${currentSha}`);

const changedFiles = changedFilesRaw
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean);

info(`변경된 파일 ${changedFiles.length}개 감지`);

// ── CodeDeltaSummary 초기화 ────────────────────────────────────────
const summary = {
  commitSha: currentSha,
  analyzedAt: new Date().toISOString(),
  newEndpoints: [],
  modifiedEndpoints: [],
  removedEndpoints: [],
  dtoChanges: [],
  riskItems: [],
  contractChanged: false,
  changedFiles: changedFiles,
};

// ── OpenAPI 계약 변경 감지 ────────────────────────────────────────
const contractChangedFiles = changedFiles.filter((f) =>
  f.startsWith("specs/openapi/")
);
if (contractChangedFiles.length > 0) {
  summary.contractChanged = true;
  summary.riskItems.push(
    `OpenAPI 계약 변경 감지: ${contractChangedFiles.join(", ")} — FE/QA 에이전트 재검토 필요`
  );
  info(`계약 파일 변경 감지: ${contractChangedFiles.join(", ")}`);
}

// ── 백엔드 컨트롤러 변경 분석 ─────────────────────────────────────
const controllerChanges = changedFiles.filter(
  (f) =>
    f.includes("controller") ||
    f.includes("Controller") ||
    f.includes(".controller.")
);

for (const file of controllerChanges) {
  if (!previousSha) continue;

  const diffOutput = run(`git diff ${diffTarget} -- "${file}"`);
  const lines = diffOutput.split("\n");

  for (const line of lines) {
    // 추가된 라우트 데코레이터 탐지 (@Get, @Post, @Put, @Patch, @Delete)
    const addedRoute = line.match(
      /^\+.*@(Get|Post|Put|Patch|Delete)\s*\(['"`]([^'"`]*)/
    );
    if (addedRoute) {
      const method = addedRoute[1].toUpperCase();
      const routePath = addedRoute[2];
      summary.newEndpoints.push(`${method} ${routePath} (${file})`);
      info(`  신규 엔드포인트 감지: ${method} ${routePath}`);
    }

    // 제거된 라우트 데코레이터 탐지
    const removedRoute = line.match(
      /^-.*@(Get|Post|Put|Patch|Delete)\s*\(['"`]([^'"`]*)/
    );
    if (removedRoute) {
      const method = removedRoute[1].toUpperCase();
      const routePath = removedRoute[2];
      summary.removedEndpoints.push(`${method} ${routePath} (${file})`);
      summary.riskItems.push(
        `엔드포인트 삭제 감지: ${method} ${routePath} — 하위 호환성 확인 필요`
      );
      info(`  삭제된 엔드포인트 감지: ${method} ${routePath}`);
    }
  }
}

// ── DTO 변경 분석 ──────────────────────────────────────────────────
const dtoChanges = changedFiles.filter(
  (f) =>
    f.includes(".dto.") ||
    f.includes("dto/") ||
    f.includes("Dto") ||
    f.includes("types.ts")
);

for (const file of dtoChanges) {
  summary.dtoChanges.push(file);
  if (file.includes("types.ts")) {
    summary.riskItems.push(
      `공유 타입 파일 변경: ${file} — 전체 소비자 영향 확인 필요`
    );
  }
  info(`  DTO 변경 감지: ${file}`);
}

// ── 에러 처리 코드 변경 분석 ─────────────────────────────────────
const errorHandlerChanges = changedFiles.filter(
  (f) =>
    f.includes("exception") ||
    f.includes("filter") ||
    f.includes("interceptor") ||
    f.includes("middleware")
);

for (const file of errorHandlerChanges) {
  summary.riskItems.push(
    `에러 처리 레이어 변경: ${file} — 에러 응답 형식 일관성 확인 필요`
  );
  info(`  에러 처리 변경 감지: ${file}`);
}

// ── 결과 출력 ────────────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log("Code Delta Summary:");
console.log(`  신규 엔드포인트: ${summary.newEndpoints.length}개`);
console.log(`  수정된 엔드포인트: ${summary.modifiedEndpoints.length}개`);
console.log(`  삭제된 엔드포인트: ${summary.removedEndpoints.length}개`);
console.log(`  DTO 변경: ${summary.dtoChanges.length}개`);
console.log(`  위험 항목: ${summary.riskItems.length}개`);
console.log(`  계약 파일 변경: ${summary.contractChanged ? "예" : "아니오"}`);

if (summary.riskItems.length > 0) {
  console.log("\n위험 항목 목록:");
  summary.riskItems.forEach((r) => console.log(`  - ${r}`));
}

// ── .ai/code-delta-summary.json 저장 ────────────────────────────
const aiDir = path.join(ROOT, ".ai");
if (!fs.existsSync(aiDir)) {
  fs.mkdirSync(aiDir, { recursive: true });
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2), "utf-8");
info(`\n결과 저장: ${path.relative(ROOT, OUTPUT_PATH)}`);
info("A(오케스트레이터)가 이 파일을 읽어 SSOT codeDeltaSummary 필드를 갱신합니다.");

process.exit(0);
